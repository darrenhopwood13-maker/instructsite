import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildVariance,
  fallbackNote,
  type VarianceDiary,
  type VariancePin,
} from "@/lib/programme-variance";
import {
  normaliseTasks,
  STP_ACCEPTED_CAP,
  toVarianceTasks,
  type StpRole,
  type StpTask,
} from "@/lib/short-term-programme";

const TaskInput = z.object({
  id: z.string().uuid().optional(),
  taskName: z.string().trim().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  predecessors: z.array(z.string().max(10)).max(20).default([]),
});

function rowToTask(r: any): StpTask {
  return {
    id: r.id,
    seq: r.seq ?? 0,
    localRef: r.local_ref,
    taskName: r.task_name,
    startDate: r.start_date,
    endDate: r.end_date,
    predecessors: (r.predecessors ?? []) as string[],
    status: r.status,
  };
}

async function nameMap(supabase: any, ids: Array<string | null | undefined>) {
  const uniq = [...new Set(ids.filter(Boolean) as string[])];
  const out = new Map<string, string>();
  if (uniq.length === 0) return out;
  const { data } = await supabase.from("profiles").select("user_id,full_name").in("user_id", uniq);
  for (const p of data ?? []) if (p.full_name) out.set(p.user_id, p.full_name);
  return out;
}

/** Whether the company has an accepted PM seat able to counter-sign. */
async function pmSeatFor(supabase: any, projectId: string, companyName: string) {
  const { data } = await supabase
    .from("subcontractor_invites")
    .select("id,accepted_by,pm_name,seat_role,company_name")
    .eq("project_id", projectId)
    .is("revoked_at", null)
    .eq("seat_role", "pm")
    .limit(50);
  const row = ((data ?? []) as any[]).find(
    (r) => r.company_name?.toLowerCase() === companyName.toLowerCase() && r.accepted_by,
  );
  return row ? { userId: row.accepted_by as string, pmName: (row.pm_name as string) ?? null } : null;
}

// =========================================================
// READS
// =========================================================

export const listShortTermProgrammes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: rows, error }, { data: invites }] = await Promise.all([
      (supabase.from("short_term_programmes") as any)
        .select(
          "id,title,company_name,package_label,status,created_via,created_at,package_invite_id," +
            "site_manager_accepted_at,site_manager_accepted_by,subcontractor_accepted_at,subcontractor_accepted_by," +
            "short_term_programme_tasks(id)",
        )
        .eq("project_id", data.projectId)
        .order("created_at", { ascending: false })
        .limit(200),
      (supabase.from("subcontractor_invites") as any)
        .select("id,company_name,trade_packages,seat_role,accepted_by,pm_name")
        .eq("project_id", data.projectId)
        .is("revoked_at", null)
        .limit(200),
    ]);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as any[];
    const names = await nameMap(
      supabase,
      list.flatMap((r) => [r.site_manager_accepted_by, r.subcontractor_accepted_by]),
    );

    // Accepted count per company+package — this is what the cap is measured on.
    const acceptedCounts: Record<string, number> = {};
    for (const r of list) {
      if (r.status !== "accepted") continue;
      const k = `${r.company_name.toLowerCase()}|${r.package_label.toLowerCase()}`;
      acceptedCounts[k] = (acceptedCounts[k] ?? 0) + 1;
    }

    // One entry per company+package the caller can create against, with the
    // remaining accepted-cap allowance and whether a PM seat exists to sign.
    const inviteRows = (invites ?? []) as any[];
    const companiesWithPm = new Set(
      inviteRows
        .filter((i) => i.seat_role === "pm" && i.accepted_by)
        .map((i) => String(i.company_name).toLowerCase()),
    );
    const targets: Array<{
      inviteId: string;
      companyName: string;
      packageLabel: string;
      acceptedCount: number;
      remaining: number;
      hasPmSeat: boolean;
      pmName: string | null;
    }> = [];
    for (const inv of inviteRows) {
      if (inv.seat_role !== "admin" && inv.seat_role !== "pm") continue;
      for (const pkg of (inv.trade_packages ?? []) as string[]) {
        const used = acceptedCounts[`${inv.company_name.toLowerCase()}|${pkg.toLowerCase()}`] ?? 0;
        targets.push({
          inviteId: inv.id,
          companyName: inv.company_name,
          packageLabel: pkg,
          acceptedCount: used,
          remaining: Math.max(0, STP_ACCEPTED_CAP - used),
          hasPmSeat: companiesWithPm.has(String(inv.company_name).toLowerCase()),
          pmName: inv.pm_name ?? null,
        });
      }
    }

    const { data: myRole } = await (supabase.rpc as any)("stp_role_for", {
      _programme_id: list[0]?.id ?? "00000000-0000-0000-0000-000000000000",
      _user_id: userId,
    });

    return {
      cap: STP_ACCEPTED_CAP,
      myRole: (myRole as StpRole | null) ?? null,
      targets,
      programmes: list.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        companyName: r.company_name as string,
        packageLabel: r.package_label as string,
        status: r.status as string,
        createdVia: r.created_via as string,
        createdAt: r.created_at as string,
        taskCount: (r.short_term_programme_tasks ?? []).length,
        siteManagerAcceptedAt: r.site_manager_accepted_at as string | null,
        siteManagerAcceptedBy: r.site_manager_accepted_by
          ? (names.get(r.site_manager_accepted_by) ?? "Site manager")
          : null,
        subcontractorAcceptedAt: r.subcontractor_accepted_at as string | null,
        subcontractorAcceptedBy: r.subcontractor_accepted_by
          ? (names.get(r.subcontractor_accepted_by) ?? "Subcontractor PM")
          : null,
      })),
    };
  });

export const getShortTermProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ programmeId: z.string().uuid(), today: z.string().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = data.today ?? new Date().toISOString().slice(0, 10);

    const { data: p, error } = await (supabase.from("short_term_programmes") as any)
      .select("*")
      .eq("id", data.programmeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) throw new Error("Programme not found.");

    const [{ data: taskRows }, { data: noteRows }, { data: roleRes }] = await Promise.all([
      (supabase.from("short_term_programme_tasks") as any)
        .select("*")
        .eq("programme_id", data.programmeId)
        .order("seq", { ascending: true }),
      (supabase.from("short_term_programme_annotations") as any)
        .select("id,task_id,author_user_id,note,created_at")
        .eq("programme_id", data.programmeId)
        .order("created_at", { ascending: false })
        .limit(500),
      (supabase.rpc as any)("stp_role_for", { _programme_id: data.programmeId, _user_id: userId }),
    ]);

    const tasks = ((taskRows ?? []) as any[]).map(rowToTask);
    const names = await nameMap(supabase, [
      ...((noteRows ?? []) as any[]).map((n) => n.author_user_id),
      p.site_manager_accepted_by,
      p.subcontractor_accepted_by,
    ]);
    const pmSeat = await pmSeatFor(supabase, p.project_id, p.company_name);

    // Scoped variance — this subcontractor's pins and QS-approved diaries for
    // this package only, run through the same engine as the master programme.
    let variance: any = null;
    if (p.status === "accepted" && tasks.length > 0) {
      const { data: companyInvites } = await (supabase.from("subcontractor_invites") as any)
        .select("accepted_by,company_name")
        .eq("project_id", p.project_id)
        .is("revoked_at", null)
        .limit(100);
      const companyUsers = new Set(
        ((companyInvites ?? []) as any[])
          .filter(
            (i) => i.accepted_by && i.company_name?.toLowerCase() === p.company_name.toLowerCase(),
          )
          .map((i) => i.accepted_by as string),
      );

      const [{ data: pinRows }, { data: diaryRows }] = await Promise.all([
        (supabase.from("live_site_activity") as any)
          .select("id,trade_package,start_time,status,operative_count,subcontractor_id,work_zones(name)")
          .eq("project_id", p.project_id)
          .ilike("trade_package", p.package_label)
          .order("start_time", { ascending: false })
          .limit(300),
        (supabase.from("daily_site_diaries") as any)
          .select(
            "id,trade_package,checkout_time,qs_status,completion_pct,manager_completion_pct,qs_verified_pct,subcontractor_id,work_zones(name)",
          )
          .eq("project_id", p.project_id)
          .ilike("trade_package", p.package_label)
          .order("checkout_time", { ascending: false })
          .limit(300),
      ]);

      const inCompany = (r: any) =>
        companyUsers.size === 0 || !r.subcontractor_id || companyUsers.has(r.subcontractor_id);

      const pins: VariancePin[] = ((pinRows ?? []) as any[]).filter(inCompany).map((r) => ({
        id: r.id,
        tradePackage: r.trade_package ?? null,
        zoneName: r.work_zones?.name ?? null,
        startTime: r.start_time,
        status: r.status,
        operativeCount: r.operative_count ?? 0,
      }));
      const diaries: VarianceDiary[] = ((diaryRows ?? []) as any[]).filter(inCompany).map((r) => ({
        id: r.id,
        tradePackage: r.trade_package ?? null,
        zoneName: r.work_zones?.name ?? null,
        checkoutTime: r.checkout_time,
        qsStatus: r.qs_status,
        completionPct: r.completion_pct ?? null,
        managerCompletionPct: r.manager_completion_pct ?? null,
        qsVerifiedPct: r.qs_verified_pct ?? null,
      }));

      const key = p.package_label.toLowerCase();
      const packages = buildVariance({
        tasks: toVarianceTasks(tasks, p.package_label),
        pins,
        diaries,
        today,
        links: { [key]: key },
      });
      const pkg = packages[0];
      if (pkg) {
        pkg.note = fallbackNote(pkg, today);
        try {
          const { writePositionNotes } = await import("@/lib/programme-variance.server");
          await writePositionNotes([pkg], today);
        } catch (err) {
          console.error("[stp] variance note generation failed", err);
        }
        variance = pkg;
      }
    }

    return {
      programme: {
        id: p.id as string,
        projectId: p.project_id as string,
        packageInviteId: p.package_invite_id as string,
        title: p.title as string,
        companyName: p.company_name as string,
        packageLabel: p.package_label as string,
        status: p.status as string,
        createdVia: p.created_via as string,
        createdAt: p.created_at as string,
        siteManagerAcceptedAt: p.site_manager_accepted_at as string | null,
        siteManagerAcceptedBy: p.site_manager_accepted_by
          ? (names.get(p.site_manager_accepted_by) ?? "Site manager")
          : null,
        subcontractorAcceptedAt: p.subcontractor_accepted_at as string | null,
        subcontractorAcceptedBy: p.subcontractor_accepted_by
          ? (names.get(p.subcontractor_accepted_by) ?? "Subcontractor PM")
          : null,
        filedDocumentId: p.site_document_id as string | null,
      },
      tasks,
      annotations: ((noteRows ?? []) as any[]).map((n) => ({
        id: n.id as string,
        taskId: n.task_id as string | null,
        note: n.note as string,
        createdAt: n.created_at as string,
        authorName: names.get(n.author_user_id) ?? "Team member",
      })),
      myRole: (roleRes as StpRole | null) ?? null,
      pmSeat,
      variance,
    };
  });

// =========================================================
// CREATE
// =========================================================

const CreateBase = {
  projectId: z.string().uuid(),
  packageInviteId: z.string().uuid(),
  packageLabel: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
};

async function insertProgramme(
  supabase: any,
  userId: string,
  base: {
    projectId: string;
    packageInviteId: string;
    packageLabel: string;
    title: string;
    createdVia: "upload" | "ai_builder";
  },
  tasks: StpTask[],
) {
  const { data: inv, error: iErr } = await supabase
    .from("subcontractor_invites")
    .select("company_name,project_id,package_manager_id")
    .eq("id", base.packageInviteId)
    .maybeSingle();
  if (iErr) throw new Error(iErr.message);
  if (!inv || inv.project_id !== base.projectId) throw new Error("Subcontractor package not found.");

  const { data: row, error } = await supabase
    .from("short_term_programmes")
    .insert({
      project_id: base.projectId,
      package_invite_id: base.packageInviteId,
      company_name: inv.company_name,
      package_label: base.packageLabel,
      title: base.title,
      created_via: base.createdVia,
      created_by: userId,
      site_manager_user_id: inv.package_manager_id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (tasks.length > 0) {
    const { error: tErr } = await supabase.from("short_term_programme_tasks").insert(
      tasks.map((t) => ({
        programme_id: row.id,
        seq: t.seq,
        local_ref: t.localRef,
        task_name: t.taskName,
        start_date: t.startDate,
        end_date: t.endDate,
        predecessors: t.predecessors,
      })),
    );
    if (tErr) throw new Error(tErr.message);
  }
  return { programmeId: row.id as string, taskCount: tasks.length };
}

/** Upload path — reuses the existing programme compiler, writes here only. */
export const createShortTermProgrammeFromUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        ...CreateBase,
        fileName: z.string().min(1).max(300),
        mimeType: z.string().max(200),
        dataBase64: z.string().min(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { compileProgrammeFile } = await import("@/lib/programme-compiler.server");
    const result = await compileProgrammeFile({
      fileName: data.fileName,
      mimeType: data.mimeType,
      dataBase64: data.dataBase64,
    });
    if (result.tasks.length === 0) {
      throw new Error(
        "No dated tasks could be read from that file. Export it as CSV, XML, XER or a text-based PDF, or use the AI Builder instead.",
      );
    }
    const tasks = normaliseTasks(
      result.tasks.map((t) => ({
        taskName: t.taskName,
        startDate: t.startDate,
        endDate: t.endDate,
        predecessors: t.predecessors ?? [],
      })),
    );
    return insertProgramme(
      context.supabase,
      context.userId,
      { ...data, createdVia: "upload" },
      tasks,
    );
  });

/** AI Builder path — activities in, proposed task list out, saved as a draft. */
export const createShortTermProgrammeFromBuilder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        ...CreateBase,
        activities: z.array(z.string().trim().min(2).max(300)).min(1).max(20),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { proposeTaskPlan } = await import("@/lib/short-term-programme.server");
    const { tasks, source } = await proposeTaskPlan({
      packageLabel: data.packageLabel,
      activities: data.activities,
      startDate: data.startDate,
    });
    const out = await insertProgramme(
      context.supabase,
      context.userId,
      { ...data, createdVia: "ai_builder" },
      tasks,
    );
    return { ...out, source };
  });

// =========================================================
// DRAFT EDITING + WORKFLOW
// =========================================================

export const saveShortTermProgrammeTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        programmeId: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        tasks: z.array(TaskInput).max(60),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: p } = await (supabase.from("short_term_programmes") as any)
      .select("status")
      .eq("id", data.programmeId)
      .maybeSingle();
    if (!p) throw new Error("Programme not found.");
    if (p.status === "accepted") {
      throw new Error("This programme is accepted and locked — add an annotation instead.");
    }

    const tasks = normaliseTasks(data.tasks);
    // Draft editing is a full replace: simplest correct semantics for a list
    // the two parties are jointly reshaping.
    const { error: dErr } = await (supabase.from("short_term_programme_tasks") as any)
      .delete()
      .eq("programme_id", data.programmeId);
    if (dErr) throw new Error(dErr.message);

    if (tasks.length > 0) {
      const { error } = await (supabase.from("short_term_programme_tasks") as any).insert(
        tasks.map((t) => ({
          programme_id: data.programmeId,
          seq: t.seq,
          local_ref: t.localRef,
          task_name: t.taskName,
          start_date: t.startDate,
          end_date: t.endDate,
          predecessors: t.predecessors,
        })),
      );
      if (error) throw new Error(error.message);
    }

    if (data.title) {
      await (supabase.from("short_term_programmes") as any)
        .update({ title: data.title })
        .eq("id", data.programmeId);
    }
    return { ok: true as const, taskCount: tasks.length };
  });

export const sendShortTermProgrammeForApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ programmeId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.rpc as any)(
      "send_short_term_programme_for_approval",
      { _programme_id: data.programmeId },
    );
    if (error) throw new Error(error.message.replace(/^.*STP_[A-Z_]+:\s*/, ""));
    return { ok: true as const };
  });

/**
 * Accept as whichever side the caller is. The RPC decides the side, refuses
 * when the subcontractor has no accepted PM seat, and enforces the 5-accepted
 * cap per company per package at the moment both signatures land.
 */
export const acceptShortTermProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ programmeId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: state, error } = await (context.supabase.rpc as any)(
      "accept_short_term_programme",
      { _programme_id: data.programmeId },
    );
    if (error) throw new Error(error.message.replace(/^.*STP_[A-Z_]+:\s*/, ""));

    let filed: string | null = null;
    if (state === "accepted") {
      try {
        filed = await fileAcceptedProgramme(context, data.programmeId);
      } catch (err) {
        // Filing must never undo an acceptance.
        console.error("[stp] project bible filing failed", err);
      }
    }
    return { state: state as string, filed };
  });

export const setShortTermTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        status: z.enum(["not_started", "in_progress", "at_risk", "done"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("short_term_programme_tasks") as any)
      .update({ status: data.status })
      .eq("id", data.taskId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const addShortTermAnnotation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        programmeId: z.string().uuid(),
        taskId: z.string().uuid().nullable().default(null),
        note: z.string().trim().min(1).max(2000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("short_term_programme_annotations") as any).insert({
      programme_id: data.programmeId,
      task_id: data.taskId,
      author_user_id: context.userId,
      note: data.note,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteShortTermProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ programmeId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("short_term_programmes") as any)
      .delete()
      .eq("id", data.programmeId)
      .neq("status", "accepted");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// =========================================================
// PROJECT BIBLE FILING (accepted only)
// =========================================================

async function fileAcceptedProgramme(
  context: { supabase: any; userId: string },
  programmeId: string,
): Promise<string | null> {
  const { supabase, userId } = context;
  const { data: p } = await supabase
    .from("short_term_programmes")
    .select("*")
    .eq("id", programmeId)
    .maybeSingle();
  if (!p || p.status !== "accepted" || p.site_document_id) return null;

  const { data: taskRows } = await supabase
    .from("short_term_programme_tasks")
    .select("*")
    .eq("programme_id", programmeId)
    .order("seq", { ascending: true });
  const tasks = ((taskRows ?? []) as any[]).map(rowToTask);

  const [{ data: proj }, names] = await Promise.all([
    supabase.from("projects").select("name").eq("id", p.project_id).maybeSingle(),
    nameMap(supabase, [p.site_manager_accepted_by, p.subcontractor_accepted_by]),
  ]);

  const { renderProgrammePdf } = await import("@/lib/short-term-programme.server");
  const bytes = await renderProgrammePdf({
    title: p.title,
    companyName: p.company_name,
    packageLabel: p.package_label,
    projectName: proj?.name ?? "Project",
    acceptedBySiteManager: `${names.get(p.site_manager_accepted_by) ?? "Site manager"} · ${p.site_manager_accepted_at}`,
    acceptedBySubcontractor: `${names.get(p.subcontractor_accepted_by) ?? "Subcontractor PM"} · ${p.subcontractor_accepted_at}`,
    tasks,
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = `${p.company_name}-${p.package_label}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  const fileName = `${stamp}-short-term-${slug}.pdf`;
  const storagePath = `short-term-programmes/${p.project_id}/${fileName}`;

  const { error: upErr } = await supabaseAdmin.storage
    .from("project-bible")
    .upload(storagePath, bytes, { contentType: "application/pdf", upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data: sd, error: sdErr } = await supabaseAdmin
    .from("site_documents")
    .insert({
      file_name: fileName,
      file_path: storagePath,
      bucket: "project-bible",
      mime_type: "application/pdf",
      file_size: bytes.byteLength,
      uploaded_by: userId,
      extraction_status: "ready",
    })
    .select("id")
    .single();
  if (sdErr || !sd) throw new Error(sdErr?.message ?? "Failed to file the programme.");

  await supabaseAdmin
    .from("short_term_programmes")
    .update({ site_document_id: sd.id })
    .eq("id", programmeId);

  return sd.id as string;
}

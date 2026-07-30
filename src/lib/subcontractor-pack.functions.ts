import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TOOLBOX_TOPICS, MAX_TOOLBOX_TOPIC_LENGTH } from "@/lib/toolbox-topics";


const REGISTER_TYPES = ["PUWER", "LOLER", "HAVS", "Plant"] as const;

async function ensureSubcontractor(
  supabase: any,
  projectId: string,
  companyName: string,
): Promise<string> {
  const name = companyName.trim();
  // company_name is not unique per project — never single-row this.
  const { data: existingRows } = await supabase
    .from("subcontractors")
    .select("id")
    .eq("project_id", projectId)
    .ilike("company_name", name)
    .order("created_at", { ascending: true })
    .limit(1);
  const existingId = existingRows?.[0]?.id as string | undefined;
  if (existingId) return existingId;
  const { data: created, error } = await supabase
    .from("subcontractors")
    .insert({ project_id: projectId, company_name: name })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id as string;
}

export const getMyCompanyForProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: inv } = await context.supabase
      .from("subcontractor_invites")
      .select("company_name")
      .eq("project_id", data.projectId)
      .eq("accepted_by", context.userId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { companyName: (inv?.company_name as string | null) ?? null };
  });

export const getSubcontractorPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        companyName: z.string().trim().min(1).max(200),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const subId = await ensureSubcontractor(context.supabase, data.projectId, data.companyName);
    const [subRes, workersRes, registersRes, talksRes, aheadsRes] = await Promise.all([
      context.supabase.from("subcontractors").select("*").eq("id", subId).single(),
      context.supabase
        .from("workers")
        .select("*")
        .eq("subcontractor_id", subId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("registers")
        .select("*")
        .eq("subcontractor_id", subId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("toolbox_talks")
        .select("*")
        .eq("subcontractor_id", subId)
        .order("date", { ascending: false })
        .limit(10),
      context.supabase
        .from("look_aheads")
        .select("*")
        .eq("subcontractor_id", subId)
        .order("date", { ascending: false })
        .limit(5),
    ]);
    return {
      subcontractor: subRes.data,
      workers: workersRes.data ?? [],
      registers: registersRes.data ?? [],
      toolboxTalks: talksRes.data ?? [],
      lookAheads: aheadsRes.data ?? [],
    };
  });

export const addWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        role: z.string().trim().max(80).optional().nullable(),
        competencyCardUrl: z.string().trim().max(500).optional().nullable(),
        cardType: z.string().trim().max(80).optional().nullable(),
        cardNumber: z.string().trim().max(80).optional().nullable(),
        cardExpiry: z.string().trim().optional().nullable(),
        onBehalf: z.boolean().optional().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workers").insert({
      subcontractor_id: data.subcontractorId,
      name: data.name,
      role: data.role || null,
      competency_card_url: data.competencyCardUrl || null,
      card_type: data.cardType || null,
      card_number: data.cardNumber || null,
      card_expiry: data.cardExpiry || null,
      recorded_by: data.onBehalf ? context.userId : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addRegister = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        type: z.enum(REGISTER_TYPES),
        assetName: z.string().trim().max(200).optional().nullable(),
        inspectionDate: z.string().trim().optional().nullable(),
        certificateUrl: z.string().trim().max(500).optional().nullable(),
        nextInspectionDue: z.string().trim().optional().nullable(),
        inspector: z.string().trim().max(160).optional().nullable(),
        onBehalf: z.boolean().optional().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("registers").insert({
      subcontractor_id: data.subcontractorId,
      type: data.type,
      asset_name: data.assetName || null,
      inspection_date: data.inspectionDate || null,
      certificate_url: data.certificateUrl || null,
      next_inspection_due: data.nextInspectionDue || null,
      inspector: data.inspector || null,
      recorded_by: data.onBehalf ? context.userId : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addToolboxTalk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        // Known topics or a free-text "Other" topic — a site manager is never blocked.
        topic: z.string().trim().min(2).max(MAX_TOOLBOX_TOPIC_LENGTH),
        attendees: z.array(z.string().trim().min(1)).max(200),
        date: z.string().trim().optional().nullable(),
        presenter: z.string().trim().max(160).optional().nullable(),
        notes: z.string().trim().max(4000).optional().nullable(),
        attachmentUrl: z.string().trim().max(500).optional().nullable(),
        onBehalf: z.boolean().optional().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("toolbox_talks").insert({
      subcontractor_id: data.subcontractorId,
      topic: data.topic,
      attendance_list: data.attendees,
      ...(data.date ? { date: data.date } : {}),
      presenter: data.presenter || null,
      notes: data.notes || null,
      attachment_url: data.attachmentUrl || null,
      recorded_by: data.onBehalf ? context.userId : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addLookAhead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        workPlan: z.string().trim().max(4000),
        isHighRisk: z.boolean().default(false),
        permitRequired: z.boolean().default(false),
        date: z.string().trim().optional().nullable(),
        onBehalf: z.boolean().optional().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("look_aheads").insert({
      subcontractor_id: data.subcontractorId,
      work_plan: data.workPlan,
      is_high_risk: data.isHighRisk,
      permit_required: data.permitRequired,
      ...(data.date ? { date: data.date } : {}),
      recorded_by: data.onBehalf ? context.userId : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getComplianceSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ path: z.string().trim().min(1).max(1000) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: sig, error } = await context.supabase.storage
      .from("compliance-docs")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: sig.signedUrl };
  });

export const getManagerPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Union invites + subcontractors so the master view mirrors what the
    // project page shows. A `subcontractors` row is only lazily created when a
    // sub opens their portal — until then we materialise one on read so
    // PUWER/LOLER/toolbox records can be recorded against a stable id.
    const [invitesRes, existingSubsRes] = await Promise.all([
      context.supabase
        .from("subcontractor_invites")
        .select("id, company_name, trade_packages, pm_name, supervisor_name, accepted_at, revoked_at, expires_at, created_at")
        .eq("project_id", data.projectId)
        .is("revoked_at", null)
        .order("company_name", { ascending: true }),
      context.supabase
        .from("subcontractors")
        .select("id, company_name, manager_name, created_at")
        .eq("project_id", data.projectId),
    ]);
    if (invitesRes.error) throw new Error(invitesRes.error.message);
    if (existingSubsRes.error) throw new Error(existingSubsRes.error.message);

    const existingByName = new Map<string, any>();
    for (const s of (existingSubsRes.data ?? []) as any[]) {
      existingByName.set(String(s.company_name).trim().toLowerCase(), s);
    }

    // Fold invites in first (authoritative list of who should be on site).
    type Row = { id: string; company_name: string; manager_name: string | null; trade_packages: string[]; status: "pending" | "active"; created_at: string };
    const rows: Row[] = [];
    const seen = new Set<string>();
    for (const inv of (invitesRes.data ?? []) as any[]) {
      const key = String(inv.company_name).trim().toLowerCase();
      seen.add(key);
      let subId: string;
      const existing = existingByName.get(key);
      if (existing) {
        subId = existing.id;
      } else {
        subId = await ensureSubcontractor(context.supabase, data.projectId, inv.company_name);
      }
      rows.push({
        id: subId,
        company_name: inv.company_name,
        manager_name: (existing?.manager_name as string | null) ?? (inv.pm_name as string | null) ?? (inv.supervisor_name as string | null) ?? null,
        trade_packages: (inv.trade_packages as string[] | null) ?? [],
        status: inv.accepted_at ? "active" : "pending",
        created_at: inv.created_at,
      });
    }
    // Include any legacy subcontractor rows without a matching invite.
    for (const s of (existingSubsRes.data ?? []) as any[]) {
      const key = String(s.company_name).trim().toLowerCase();
      if (seen.has(key)) continue;
      rows.push({
        id: s.id,
        company_name: s.company_name,
        manager_name: s.manager_name ?? null,
        trade_packages: [],
        status: "active",
        created_at: s.created_at,
      });
    }

    const detailed = await Promise.all(
      rows.map(async (s) => {
        const [w, r, t, l] = await Promise.all([
          context.supabase.from("workers").select("id,name,role,competency_card_url,card_type,card_number,card_expiry,recorded_by,created_at").eq("subcontractor_id", s.id).order("created_at", { ascending: false }),
          context.supabase.from("registers").select("id,type,asset_name,inspection_date,next_inspection_due,inspector,certificate_url,recorded_by,created_at").eq("subcontractor_id", s.id).order("created_at", { ascending: false }),
          context.supabase.from("toolbox_talks").select("id,topic,attendance_list,date,presenter,notes,attachment_url,recorded_by,created_at").eq("subcontractor_id", s.id).order("date", { ascending: false }).limit(100),
          context.supabase.from("look_aheads").select("id,work_plan,is_high_risk,permit_required,date,recorded_by,created_at").eq("subcontractor_id", s.id).order("date", { ascending: false }).limit(100),
        ]);
        return {
          ...s,
          workers: w.data ?? [],
          registers: r.data ?? [],
          toolboxTalks: t.data ?? [],
          lookAheads: l.data ?? [],
        };
      }),
    );
    return { subcontractors: detailed };
  });


export const checkWorkerDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows } = await context.supabase
      .from("workers")
      .select("id, competency_card_url, created_at")
      .eq("subcontractor_id", data.subcontractorId)
      .ilike("name", data.name);
    const same = (rows ?? []) as any[];
    return {
      exists: same.length > 0,
      hasCard: same.some((r) => !!r.competency_card_url),
      sameDay: same.some((r) => (r.created_at ?? "").slice(0, 10) === today),
    };
  });

export const checkRegisterDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subcontractorId: z.string().uuid(),
        type: z.enum(REGISTER_TYPES),
        assetName: z.string().trim().max(200).optional().nullable(),
        inspectionDate: z.string().trim().optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("registers")
      .select("id, certificate_url, inspection_date")
      .eq("subcontractor_id", data.subcontractorId)
      .eq("type", data.type);
    if (data.assetName) q = q.ilike("asset_name", data.assetName);
    if (data.inspectionDate) q = q.eq("inspection_date", data.inspectionDate);
    const { data: rows } = await q;
    const same = (rows ?? []) as any[];
    return {
      exists: same.length > 0,
      hasCert: same.some((r) => !!r.certificate_url),
    };
  });

export const TOOLBOX_TOPIC_OPTIONS = TOOLBOX_TOPICS;
export const REGISTER_TYPE_OPTIONS = REGISTER_TYPES;


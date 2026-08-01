import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const submitSchema = z.object({
  liveActivityId: z.string().uuid(),
  progressStatus: z.enum(["completed", "partial", "not_completed"]),
  completionPct: z.number().int().min(0).max(100),
  notes: z.string().trim().max(2000).optional(),
  photoUrls: z.array(z.string().trim().max(500)).max(20).optional(),
});

export const submitDailyDiary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => submitSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: pin, error: pinErr } = await (context.supabase
      .from("live_site_activity") as any)
      .select(
        "id, project_id, subcontractor_id, drawing_id, zone_id, workface_id, trade_package, operative_count, start_time, scheduled_finish, status",
      )
      .eq("id", data.liveActivityId)
      .single();
    if (pinErr || !pin) throw new Error("Active pin not found.");
    if (pin.subcontractor_id !== context.userId)
      throw new Error("You can only close out your own shift.");
    if (pin.status !== "active") throw new Error("This shift has already been closed out.");

    const checkoutTime = new Date();
    const hours =
      Math.max(0, checkoutTime.getTime() - new Date(pin.start_time).getTime()) / 3_600_000;

    const { data: diary, error: insErr } = await (context.supabase
      .from("daily_site_diaries") as any)
      .insert({
        project_id: pin.project_id,
        live_activity_id: pin.id,
        subcontractor_id: context.userId,
        drawing_id: pin.drawing_id,
        zone_id: pin.zone_id,
        workface_id: pin.workface_id,
        trade_package: pin.trade_package,
        operative_count: pin.operative_count,
        start_time: pin.start_time,
        scheduled_finish: pin.scheduled_finish,
        checkout_time: checkoutTime.toISOString(),
        hours_logged: Number(hours.toFixed(2)),
        progress_status: data.progressStatus,
        completion_pct: data.completionPct,
        notes: data.notes ?? null,
        photo_urls: data.photoUrls ?? [],
      })
      .select("*")
      .single();
    if (insErr) throw new Error(insErr.message);

    const { error: updErr } = await context.supabase
      .from("live_site_activity")
      .update({ status: "archived" })
      .eq("id", pin.id);
    if (updErr) throw new Error(updErr.message);

    return diary;
  });

export const listQsQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase
      .from("daily_site_diaries") as any)
      .select(
        "id, trade_package, operative_count, hours_logged, start_time, checkout_time, progress_status, completion_pct, manager_completion_pct, manager_notes, manager_photo_urls, inspected_by, inspected_at, notes, qs_status, qs_rejection_reason, qs_remeasure_required, ifc_synced, photo_urls, zone_id, workface_id, drawing_id, work_zones(name, level), project_drawings(drawing_no, title)",
      )
      .eq("project_id", data.projectId)
      .order("checkout_time", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setDiaryQsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        diaryId: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        reason: z.string().trim().min(1).max(2000).optional(),
        remeasureRequired: z.boolean().optional(),
      })
      .superRefine((val, ctx) => {
        if (val.status === "rejected" && (!val.reason || val.reason.length < 10)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["reason"],
            message: "A rejection reason (10+ characters) is required.",
          });
        }
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Fetch the diary first: a qs user is only authorised on projects where
    // they hold a project_members row with role_on_project = 'qs'.
    const { data: diary, error: fetchErr } = await context.supabase
      .from("daily_site_diaries")
      .select("id, completion_pct, project_id")
      .eq("id", data.diaryId)
      .single();
    if (fetchErr || !diary) throw new Error("Diary not found.");

    // Server-side role gate: site_manager, project_admin, master_admin (as
    // before), plus qs when assigned to this project.
    const roles: Array<"master_admin" | "project_admin" | "site_manager"> = [
      "master_admin",
      "project_admin",
      "site_manager",
    ];
    const checks = await Promise.all(
      roles.map((r) => context.supabase.rpc("has_role", { _user_id: context.userId, _role: r })),
    );
    let authorised = checks.some((c) => c.data === true);

    if (!authorised) {
      const { data: isQs } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "qs",
      });
      if (isQs === true) {
        const { data: membership } = await context.supabase
          .from("project_members")
          .select("id")
          .eq("project_id", (diary as any).project_id)
          .eq("user_id", context.userId)
          .eq("role_on_project", "qs")
          .limit(1);
        authorised = !!membership && membership.length > 0;
      }
    }

    if (!authorised) {
      throw new Error(
        "Forbidden: QS approval requires site_manager, project_admin, master_admin, or an assigned qs role.",
      );
    }

    // Approving via this path clears any prior rejection metadata; rejecting
    // records the manager's written reason and remeasure flag.
    const patch: Record<string, unknown> =
      data.status === "rejected"
        ? {
            qs_status: "rejected",
            qs_rejection_reason: data.reason ?? null,
            qs_remeasure_required: !!data.remeasureRequired,
          }
        : {
            qs_status: "approved",
            qs_rejection_reason: null,
            qs_remeasure_required: false,
          };

    // The only UPDATE policy on daily_site_diaries is is_project_admin(), so a
    // site_manager/qs would silently update zero rows through the user-scoped
    // client. The code-level role check above is the real authorisation.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin.from("daily_site_diaries") as any)
      .update(patch)
      .eq("id", data.diaryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const listArchivedToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count, error } = await context.supabase
      .from("daily_site_diaries")
      .select("id", { count: "exact", head: true })
      .eq("project_id", data.projectId)
      .gte("checkout_time", startOfDay.toISOString());
    if (error) throw new Error(error.message);
    return { count: count ?? 0 };
  });

export const listZoneCompletion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // NOTE: this was previously unused anywhere in the UI, and returned
    // raw completion_pct (the subcontractor's unverified claim) rather
    // than the manager-authorised figure everything else in the app now
    // uses (see workface_approved_completion() / manager_authorise_diary()
    // in the Step 3 / Step 5 migrations). Fixed here before anything
    // starts consuming it, so a future zone-summary view doesn't
    // silently inherit the old, un-inspected numbers.
    const { data: rows, error } = await (context.supabase
      .from("daily_site_diaries") as any)
      .select(
        "zone_id, completion_pct, manager_completion_pct, qs_status, ifc_synced, work_zones(name, level)",
      )
      .eq("project_id", data.projectId)
      .not("zone_id", "is", null)
      .order("checkout_time", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      ...r,
      authorised_completion_pct: r.manager_completion_pct ?? r.completion_pct,
    }));
  });

export const signDiaryPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        paths: z.array(z.string().trim().min(1).max(500)).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    if (data.paths.length === 0) return [] as Array<{ path: string; url: string | null }>;
    // Normalize: if a path is a full public URL, extract the key after the bucket segment.
    const norm = data.paths.map((p) => {
      const idx = p.indexOf("/diary-photos/");
      if (idx >= 0) return p.slice(idx + "/diary-photos/".length);
      return p.replace(/^\/+/, "");
    });
    const { data: signed, error } = await context.supabase.storage
      .from("diary-photos")
      .createSignedUrls(norm, 3600);
    if (error) throw new Error(error.message);
    return (signed ?? []).map((s, i) => ({
      path: data.paths[i],
      url: s.error ? null : s.signedUrl,
    }));
  });

// Manager inspection & sign-off (Step 5). Replaces a plain "approve" with
// a genuine manager-assessed completion percentage, notes, and photo
// evidence captured on inspection — distinct from the subcontractor's own
// checkout claim in completion_pct, which is left untouched for
// comparison. See manager_authorise_diary() in the migration for the
// authoritative logic; this just validates input and wraps the RPC.
export const managerAuthoriseDiary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        diaryId: z.string().uuid(),
        managerCompletionPct: z.number().int().min(0).max(100),
        managerNotes: z.string().trim().max(2000).optional(),
        managerPhotoUrls: z.array(z.string().trim().max(500)).max(20).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "manager_authorise_diary" as never,
      {
        _diary_id: data.diaryId,
        _manager_completion_pct: data.managerCompletionPct,
        _manager_notes: data.managerNotes ?? null,
        _manager_photo_urls: data.managerPhotoUrls ?? [],
      } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Corrects an already-approved diary's manager-authorised percentage.
// Requires a reason and is logged to diary_amendments — see
// amend_approved_diary() in the migration. This is the ONLY sanctioned
// way to change an approved day's figures; a plain update bypasses the
// audit trail.
export const amendApprovedDiary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        diaryId: z.string().uuid(),
        newManagerCompletionPct: z.number().int().min(0).max(100),
        reason: z.string().trim().min(1).max(1000),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "amend_approved_diary" as never,
      {
        _diary_id: data.diaryId,
        _new_manager_completion_pct: data.newManagerCompletionPct,
        _reason: data.reason,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listDiaryAmendments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ diaryId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("diary_amendments")
      .select(
        "id, reason, previous_manager_completion_pct, new_manager_completion_pct, previous_qs_status, new_qs_status, created_at, changed_by",
      )
      .eq("diary_id", data.diaryId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

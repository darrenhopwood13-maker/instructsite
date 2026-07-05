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
    const { data: pin, error: pinErr } = await context.supabase
      .from("live_site_activity")
      .select(
        "id, project_id, subcontractor_id, drawing_id, zone_id, trade_package, operative_count, start_time, scheduled_finish, status",
      )
      .eq("id", data.liveActivityId)
      .single();
    if (pinErr || !pin) throw new Error("Active pin not found.");
    if (pin.subcontractor_id !== context.userId)
      throw new Error("You can only close out your own shift.");
    if (pin.status !== "active")
      throw new Error("This shift has already been closed out.");

    const checkoutTime = new Date();
    const hours =
      Math.max(0, checkoutTime.getTime() - new Date(pin.start_time).getTime()) /
      3_600_000;

    const { data: diary, error: insErr } = await context.supabase
      .from("daily_site_diaries")
      .insert({
        project_id: pin.project_id,
        live_activity_id: pin.id,
        subcontractor_id: context.userId,
        drawing_id: pin.drawing_id,
        zone_id: pin.zone_id,
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
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("daily_site_diaries")
      .select(
        "id, trade_package, operative_count, hours_logged, progress_status, completion_pct, notes, checkout_time, qs_status, ifc_synced, photo_urls, zone_id, drawing_id, work_zones(name, level), project_drawings(drawing_no, title)",
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
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Server-side role gate: only site_manager, project_admin, or master_admin
    // may set QS status. Subcontractors are hard-blocked.
    const roles: Array<"master_admin" | "project_admin" | "site_manager"> = [
      "master_admin",
      "project_admin",
      "site_manager",
    ];
    const checks = await Promise.all(
      roles.map((r) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: r }),
      ),
    );
    const authorised = checks.some((c) => c.data === true);
    if (!authorised) {
      throw new Error(
        "Forbidden: QS approval requires site_manager, project_admin, or master_admin role.",
      );
    }

    const { data: diary, error: fetchErr } = await context.supabase
      .from("daily_site_diaries")
      .select("id, completion_pct")
      .eq("id", data.diaryId)
      .single();
    if (fetchErr || !diary) throw new Error("Diary not found.");

    // Just set qs_status — the DB trigger `trg_sync_zone_ifc` re-tallies the
    // zone's approved completion and flips ifc_synced when cumulative >= 100.
    const { error } = await context.supabase
      .from("daily_site_diaries")
      .update({ qs_status: data.status })
      .eq("id", data.diaryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const listArchivedToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(i),
  )
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
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("daily_site_diaries")
      .select("zone_id, completion_pct, qs_status, ifc_synced, work_zones(name, level)")
      .eq("project_id", data.projectId)
      .not("zone_id", "is", null)
      .order("checkout_time", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
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

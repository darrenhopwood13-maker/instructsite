import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createLivePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        drawingId: z.string().uuid().nullable().optional(),
        zoneId: z.string().uuid().nullable().optional(),
        workfaceId: z.string().uuid().nullable().optional(),
        tradePackage: z.string().trim().max(120).optional(),
        operativeCount: z.number().int().min(1).max(500),
        startTime: z.string().datetime(),
        scheduledFinish: z.string().datetime(),
        xPct: z.number().min(0).max(1),
        yPct: z.number().min(0).max(1),
        notes: z.string().trim().max(1000).optional(),
        highRiskFlags: z.array(z.string().trim().max(64)).max(20).optional(),
        /** Paper-briefing description recorded against the activities register. */
        activityDescription: z.string().trim().max(2000).optional(),
        /** task_ref of the baseline programme task this pin delivers, when known. */
        programmeTaskRef: z.string().trim().max(120).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("live_site_activity")
      .insert({
        project_id: data.projectId,
        drawing_id: data.drawingId ?? null,
        zone_id: data.zoneId ?? null,
        workface_id: data.workfaceId ?? null,
        subcontractor_id: context.userId,
        trade_package: data.tradePackage ?? null,
        operative_count: data.operativeCount,
        start_time: data.startTime,
        scheduled_finish: data.scheduledFinish,
        x_pct: data.xPct,
        y_pct: data.yPct,
        notes: data.notes ?? null,
        high_risk_flags: data.highRiskFlags ?? [],
        programme_task_ref: data.programmeTaskRef ?? null,
      })
      .select("id,permit_required,permit_status,high_risk_flags,hazard_scanned")
      .single();
    if (error) throw new Error(error.message);

    // Mirror the pin into the activities register (the paper briefing record),
    // so the permit trigger + permit register have something to hang off.
    const description =
      data.activityDescription?.trim() ||
      [data.tradePackage?.trim(), data.notes?.trim()].filter(Boolean).join(" — ") ||
      "Site activity briefing";

    const { data: act, error: aErr } = await context.supabase
      .from("activities")
      .insert({
        project_id: data.projectId,
        subcontractor_id: context.userId,
        drawing_id: data.drawingId ?? null,
        zone_id: data.zoneId ?? null,
        description,
        // Use the flags the DB trigger actually derived, not the client's guess.
        high_risk_flags: (row?.high_risk_flags ?? data.highRiskFlags ?? []) as string[],
        programme_task_ref: data.programmeTaskRef ?? null,
      })
      .select("id,permit_status")
      .single();

    if (aErr) {
      // Never block the pin drop on the register write.
      console.error("[live-pin] activity register write failed:", aErr.message);
      return row;
    }

    await (context.supabase as any)
      .from("live_site_activity")
      .update({ activity_id: act.id })
      .eq("id", row.id);

    return { ...row, activity_id: act.id, activity_permit_status: act.permit_status };
  });

export const listLivePins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        drawingId: z.string().uuid().optional(),
        activeOnly: z.boolean().optional().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("live_site_activity")
      .select(
        "id,project_id,drawing_id,zone_id,subcontractor_id,trade_package,operative_count,start_time,scheduled_finish,x_pct,y_pct,status,notes,permit_required,permit_status,high_risk_flags,hazard_scanned,activity_id,programme_task_ref,created_at,work_zones(name,level),project_drawings(drawing_no,title)",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.drawingId) q = q.eq("drawing_id", data.drawingId);
    if (data.activeOnly) q = q.eq("status", "active");
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const closeLivePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ pinId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("live_site_activity")
      .update({ status: "closed" })
      .eq("id", data.pinId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const issuePinPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        pinId: z.string().uuid(),
        validHours: z
          .number()
          .int()
          .min(1)
          .max(24 * 30)
          .default(8),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: permitId, error } = await context.supabase.rpc(
      "issue_pin_permit" as never,
      {
        _pin_id: data.pinId,
        _valid_hours: data.validHours,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { permitId: permitId as unknown as string };
  });

export const managerForceCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        pinId: z.string().uuid(),
        completionPct: z.number().int().min(0).max(100),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: diaryId, error } = await context.supabase.rpc(
      "manager_force_checkout" as never,
      {
        _pin_id: data.pinId,
        _completion_pct: data.completionPct,
        _notes: data.notes ?? "",
      } as never,
    );
    if (error) throw new Error(error.message);
    return { diaryId: diaryId as unknown as string };
  });

export const getPinDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ pinId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: pin, error } = await context.supabase
      .from("live_site_activity")
      .select(
        "id,project_id,drawing_id,zone_id,subcontractor_id,trade_package,operative_count,start_time,scheduled_finish,x_pct,y_pct,status,notes,permit_required,permit_status,high_risk_flags,hazard_scanned,activity_id,programme_task_ref,created_at,work_zones(name,level),project_drawings(drawing_no,title)",
      )
      .eq("id", data.pinId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!pin) throw new Error("Pin not found");

    // Look up the subcontractor's display name from their profile.
    let subcontractorName: string | null = null;
    if (pin.subcontractor_id) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", pin.subcontractor_id)
        .maybeSingle();
      subcontractorName = prof?.full_name ?? null;
    }

    // Look up the company name via an accepted subcontractor invite on this project.
    let companyName: string | null = null;
    if (pin.subcontractor_id && pin.project_id) {
      const { data: inv } = await context.supabase
        .from("subcontractor_invites")
        .select("company_name")
        .eq("project_id", pin.project_id)
        .eq("accepted_by", pin.subcontractor_id)
        .not("accepted_at", "is", null)
        .order("accepted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      companyName = inv?.company_name ?? null;
    }

    // Active permits (either directly linked to the activity, or currently open on this project).
    let permits: Array<{
      id: string;
      permit_type: string;
      status: string;
      valid_from: string | null;
      valid_to: string | null;
    }> = [];
    if (pin.activity_id) {
      const { data: rows } = await context.supabase
        .from("permits")
        .select("id,permit_type,status,valid_from,valid_to")
        .eq("activity_id", pin.activity_id)
        .order("valid_from", { ascending: false });
      permits = (rows ?? []) as never;
    }

    return { pin, subcontractorName, companyName, permits };
  });

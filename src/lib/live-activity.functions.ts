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
        tradePackage: z.string().trim().max(120).optional(),
        operativeCount: z.number().int().min(1).max(500),
        startTime: z.string().datetime(),
        scheduledFinish: z.string().datetime(),
        xPct: z.number().min(0).max(1),
        yPct: z.number().min(0).max(1),
        notes: z.string().trim().max(1000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("live_site_activity")
      .insert({
        project_id: data.projectId,
        drawing_id: data.drawingId ?? null,
        zone_id: data.zoneId ?? null,
        subcontractor_id: context.userId,
        trade_package: data.tradePackage ?? null,
        operative_count: data.operativeCount,
        start_time: data.startTime,
        scheduled_finish: data.scheduledFinish,
        x_pct: data.xPct,
        y_pct: data.yPct,
        notes: data.notes ?? null,
      })
      .select("id,permit_required,permit_status,high_risk_flags")
      .single();
    if (error) throw new Error(error.message);
    return row;
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
        "id,project_id,drawing_id,zone_id,subcontractor_id,trade_package,operative_count,start_time,scheduled_finish,x_pct,y_pct,status,notes,permit_required,permit_status,high_risk_flags,activity_id,created_at,work_zones(name,level),project_drawings(drawing_no,title)",
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
  .inputValidator((i: unknown) =>
    z.object({ pinId: z.string().uuid() }).parse(i),
  )
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
        validHours: z.number().int().min(1).max(24 * 30).default(8),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: permitId, error } = await context.supabase.rpc("issue_pin_permit" as never, {
      _pin_id: data.pinId,
      _valid_hours: data.validHours,
    } as never);
    if (error) throw new Error(error.message);
    return { permitId: permitId as unknown as string };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const HIGH_RISK = ["working_at_height", "hot_works", "confined_space"] as const;

export const createActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        drawingId: z.string().uuid().optional(),
        zoneId: z.string().uuid().optional(),
        description: z.string().trim().min(1).max(2000),
        highRiskFlags: z.array(z.enum(HIGH_RISK)).default([]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("activities")
      .insert({
        project_id: data.projectId,
        subcontractor_id: context.userId,
        drawing_id: data.drawingId ?? null,
        zone_id: data.zoneId ?? null,
        description: data.description,
        high_risk_flags: data.highRiskFlags,
      })
      .select("id,permit_status")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listProjectActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("activities")
      .select(
        "id,description,high_risk_flags,permit_status,created_at,drawing_id,zone_id,subcontractor_id,project_drawings(drawing_no,title),work_zones(name,level)",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const issuePermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        activityId: z.string().uuid(),
        permitType: z.enum(HIGH_RISK),
        validHours: z.number().int().min(1).max(24 * 30).default(8),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const now = new Date();
    const to = new Date(now.getTime() + data.validHours * 3600 * 1000);
    const { error: pErr } = await context.supabase.from("permits").insert({
      project_id: data.projectId,
      activity_id: data.activityId,
      permit_type: data.permitType,
      issued_by: context.userId,
      valid_from: now.toISOString(),
      valid_to: to.toISOString(),
      status: "active",
    });
    if (pErr) throw new Error(pErr.message);
    const { error: aErr } = await context.supabase
      .from("activities")
      .update({ permit_status: "active" })
      .eq("id", data.activityId);
    if (aErr) throw new Error(aErr.message);
    return { ok: true };
  });

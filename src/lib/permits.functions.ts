import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { HIGH_RISK_CATEGORIES } from "@/lib/high-risk";

export type PermitEventRow = {
  id: string;
  permit_id: string | null;
  activity_id: string | null;
  event_type: string;
  actor_id: string | null;
  actor_name?: string | null;
  reason: string | null;
  metadata: Record<string, string | number | boolean | null> | null;
  created_at: string;
};

export type PermitRow = {
  id: string;
  permit_type: string;
  status: string;
  valid_from: string | null;
  valid_to: string | null;
  issued_by: string | null;
  issued_by_name?: string | null;
  events?: PermitEventRow[];
};


export type UnlinkedPinRow = {
  id: string;
  trade_package: string | null;
  notes: string | null;
  operative_count: number;
  permit_required: boolean;
  permit_status: string;
  high_risk_flags: string[];
  start_time: string;
  scheduled_finish: string;
  status: string;
  zone_id: string | null;
  work_zones: { name: string; level: string | null } | null;
};

export type ActivityRegisterRow = {
  id: string;
  description: string;
  high_risk_flags: string[];
  permit_status: string;
  created_at: string;
  zone_id: string | null;
  drawing_id: string | null;
  subcontractor_id: string;
  work_zones: { name: string; level: string | null } | null;
  project_drawings: { drawing_no: string | null; title: string | null } | null;
  permits: PermitRow[];
};

/**
 * Permit register for a project: every logged activity with its permit trail,
 * plus any legacy DABS pins that were flagged high-risk before an activity
 * record existed for them.
 */
export const listPermitRegister = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: activities, error } = await context.supabase
      .from("activities")
      .select(
        "id,description,high_risk_flags,permit_status,created_at,zone_id,drawing_id,subcontractor_id,work_zones(name,level),project_drawings(drawing_no,title),permits(id,permit_type,status,valid_from,valid_to,issued_by)",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const rows = (activities ?? []) as unknown as ActivityRegisterRow[];

    // Legacy / unlinked pins that the hazard trigger flagged but which have no
    // activity record yet — they are issued through issue_pin_permit instead.
    const { data: pins, error: pErr } = await context.supabase
      .from("live_site_activity")
      .select(
        "id,trade_package,notes,operative_count,permit_required,permit_status,high_risk_flags,start_time,scheduled_finish,status,zone_id,work_zones(name,level)",
      )
      .eq("project_id", data.projectId)
      .eq("permit_required", true)
      .is("activity_id", null)
      .neq("status", "archived")
      .order("start_time", { ascending: false })
      .limit(200);
    if (pErr) throw new Error(pErr.message);

    // Audit trail for every permit on this project.
    const { data: events } = await context.supabase
      .from("permit_events")
      .select("id,permit_id,activity_id,event_type,actor_id,reason,metadata,created_at")
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: true })
      .limit(2000);
    const eventRows = (events ?? []) as unknown as PermitEventRow[];

    // Resolve issuer + requester + actor display names in one pass.
    const ids = new Set<string>();
    for (const a of rows) {
      if (a.subcontractor_id) ids.add(a.subcontractor_id);
      for (const p of a.permits ?? []) if (p.issued_by) ids.add(p.issued_by);
    }
    for (const e of eventRows) if (e.actor_id) ids.add(e.actor_id);
    const names = new Map<string, string>();
    if (ids.size) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("user_id,full_name")
        .in("user_id", [...ids]);
      for (const p of profs ?? []) if (p.full_name) names.set(p.user_id, p.full_name);
    }

    const byPermit = new Map<string, PermitEventRow[]>();
    for (const e of eventRows) {
      e.actor_name = e.actor_id ? (names.get(e.actor_id) ?? null) : null;
      if (!e.permit_id) continue;
      const list = byPermit.get(e.permit_id) ?? [];
      list.push(e);
      byPermit.set(e.permit_id, list);
    }

    for (const a of rows) {
      for (const p of a.permits ?? []) {
        p.issued_by_name = p.issued_by ? (names.get(p.issued_by) ?? null) : null;
        p.events = byPermit.get(p.id) ?? [];
      }
    }

    return {
      activities: rows.map((a) => ({
        ...a,
        requested_by_name: names.get(a.subcontractor_id) ?? null,
      })),
      unlinkedPins: (pins ?? []) as unknown as UnlinkedPinRow[],
    };
  });


export const issueActivityPermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        activityId: z.string().uuid(),
        permitType: z.enum(HIGH_RISK_CATEGORIES),
        validHours: z.number().int().min(1).max(720).default(8),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: permitId, error } = await context.supabase.rpc(
      "issue_activity_permit" as never,
      {
        _activity_id: data.activityId,
        _permit_type: data.permitType,
        _valid_hours: data.validHours,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { permitId: permitId as unknown as string };
  });

export const revokePermit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        permitId: z.string().uuid(),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("revoke_permit" as never, {
      _permit_id: data.permitId,
      _reason: data.reason ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Count of work awaiting a permit — used for the amber badge in nav bars. */
export const countOutstandingPermits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count: actCount, error } = await context.supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("project_id", data.projectId)
      .eq("permit_status", "required");
    if (error) throw new Error(error.message);

    const { count: pinCount, error: pErr } = await context.supabase
      .from("live_site_activity")
      .select("id", { count: "exact", head: true })
      .eq("project_id", data.projectId)
      .eq("permit_required", true)
      .is("activity_id", null)
      .neq("status", "archived");
    if (pErr) throw new Error(pErr.message);

    return { outstanding: (actCount ?? 0) + (pinCount ?? 0) };
  });

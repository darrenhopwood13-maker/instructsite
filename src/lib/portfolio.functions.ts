import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cross-project portfolio summary for master_admin / project_admin.
 * Returns per-project live metrics + aggregate global counters + a
 * recent alert stream (overtime, pending permits, high-risk pins).
 */
export const getPortfolioSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Role gate
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role as string);
    const canView =
      roles.includes("master_admin") || roles.includes("project_admin");
    if (!canView) throw new Error("Portfolio view requires admin role.");

    // Visible projects (RLS handles filter for project_admin)
    const { data: projects, error: pErr } = await supabase
      .from("projects")
      .select("id,name,site_address,created_at")
      .order("created_at", { ascending: false });
    if (pErr) throw new Error(pErr.message);

    const ids = (projects ?? []).map((p: any) => p.id);
    if (ids.length === 0) {
      return {
        projects: [],
        totals: {
          activeProjects: 0,
          totalManpower: 0,
          pendingValuations: 0,
          activePermits: 0,
        },
        alerts: [],
      };
    }

    const [pinsRes, diariesRes, permitsRes] = await Promise.all([
      supabase
        .from("live_site_activity")
        .select(
          "id,project_id,trade_package,operative_count,start_time,scheduled_finish,permit_required,permit_status,high_risk_flags,created_at",
        )
        .in("project_id", ids)
        .eq("status", "active"),
      supabase
        .from("daily_site_diaries")
        .select("id,project_id,qs_status")
        .in("project_id", ids)
        .eq("qs_status", "pending"),
      supabase
        .from("permits")
        .select("id,project_id,permit_type,status,valid_to")
        .in("project_id", ids)
        .eq("status", "active"),
    ]);

    const pins = pinsRes.data ?? [];
    const pendingValuations = (diariesRes.data ?? []).length;
    const activePermits = (permitsRes.data ?? []).length;
    const now = Date.now();

    const perProject = (projects ?? []).map((p: any) => {
      const projectPins = pins.filter((x: any) => x.project_id === p.id);
      const projectPermits = (permitsRes.data ?? []).filter(
        (x: any) => x.project_id === p.id,
      );
      const overtimeCount = projectPins.filter(
        (x: any) => new Date(x.scheduled_finish).getTime() < now,
      ).length;
      const manpower = projectPins.reduce(
        (s: number, x: any) => s + (x.operative_count ?? 0),
        0,
      );
      const pendingPermits = projectPins.filter(
        (x: any) => x.permit_status === "required",
      ).length;
      return {
        id: p.id,
        name: p.name,
        site_address: p.site_address ?? null,
        active_crews: projectPins.length,
        manpower,
        overtime: overtimeCount,
        open_permits: projectPermits.length,
        pending_permits: pendingPermits,
      };
    });

    const projectNameById = new Map(
      (projects ?? []).map((p: any) => [p.id, p.name as string]),
    );

    const alerts: Array<{
      id: string;
      kind: "overtime" | "permit" | "high_risk";
      project_id: string;
      project_name: string;
      label: string;
      at: string;
    }> = [];

    for (const pin of pins) {
      const pname = projectNameById.get(pin.project_id) ?? "Project";
      if (new Date(pin.scheduled_finish).getTime() < now) {
        alerts.push({
          id: `ot-${pin.id}`,
          kind: "overtime",
          project_id: pin.project_id,
          project_name: pname,
          label: `Overtime — ${pin.trade_package ?? "Crew"}`,
          at: pin.scheduled_finish,
        });
      }
      if (pin.permit_status === "required") {
        alerts.push({
          id: `pr-${pin.id}`,
          kind: "permit",
          project_id: pin.project_id,
          project_name: pname,
          label: `Permit Required — ${(pin.high_risk_flags ?? []).join(", ").replace(/_/g, " ") || pin.trade_package || "High-risk task"}`,
          at: pin.created_at,
        });
      } else if ((pin.high_risk_flags ?? []).length > 0) {
        alerts.push({
          id: `hr-${pin.id}`,
          kind: "high_risk",
          project_id: pin.project_id,
          project_name: pname,
          label: `High-Risk Task — ${(pin.high_risk_flags ?? []).join(", ").replace(/_/g, " ")}`,
          at: pin.created_at,
        });
      }
    }

    alerts.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return {
      projects: perProject,
      totals: {
        activeProjects: perProject.filter((p) => p.active_crews > 0).length,
        totalManpower: perProject.reduce((s, p) => s + p.manpower, 0),
        pendingValuations,
        activePermits,
      },
      alerts: alerts.slice(0, 40),
    };
  });

import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";

function supabaseForUser(ctx: ToolContext) {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "get_portfolio_summary",
  title: "Portfolio summary",
  description:
    "Cross-project portfolio snapshot for master_admin / project_admin: active crews, manpower, overtime, permits and recent alerts across all visible projects.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role as string);
    const canView =
      roles.includes("master_admin") || roles.includes("project_admin");
    if (!canView) {
      return {
        content: [{ type: "text", text: "Portfolio view requires admin role." }],
        isError: true,
      };
    }

    const { data: projects, error } = await supabase
      .from("projects")
      .select("id,name,site_address")
      .order("created_at", { ascending: false });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }

    const ids = (projects ?? []).map((p: any) => p.id);
    if (ids.length === 0) {
      const empty = { projects: [], totals: { activeProjects: 0, totalManpower: 0 } };
      return {
        content: [{ type: "text", text: JSON.stringify(empty, null, 2) }],
        structuredContent: empty,
      };
    }

    const { data: pins } = await supabase
      .from("live_site_activity")
      .select("project_id,operative_count,scheduled_finish")
      .in("project_id", ids)
      .eq("status", "active");

    const now = Date.now();
    const perProject = (projects ?? []).map((p: any) => {
      const pp = (pins ?? []).filter((x: any) => x.project_id === p.id);
      return {
        id: p.id,
        name: p.name,
        site_address: p.site_address ?? null,
        active_crews: pp.length,
        manpower: pp.reduce((s: number, x: any) => s + (x.operative_count ?? 0), 0),
        overtime: pp.filter(
          (x: any) => new Date(x.scheduled_finish).getTime() < now,
        ).length,
      };
    });

    const result = {
      projects: perProject,
      totals: {
        activeProjects: perProject.filter((p) => p.active_crews > 0).length,
        totalManpower: perProject.reduce((s, p) => s + p.manpower, 0),
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});

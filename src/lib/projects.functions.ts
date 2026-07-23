import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerFromClaims } from "@/lib/owner";

export const listMyProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select(
        "id,name,site_address,scope_brief,master_admin_id,project_admin_id,org_id,created_at,orgs:org_id(id,name)",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    let roles = (data ?? []).map((r: { role: string }) => r.role);

    if (roles.length === 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { count, error: countErr } = await supabaseAdmin
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "master_admin");
      if (!countErr && (count ?? 0) === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insErr } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: context.userId, role: "master_admin" as any });
        if (!insErr) roles = ["master_admin"];
      }
    }

    return { userId: context.userId, roles };
  });

/** Orgs the caller can create projects in (founder → all, org admins → their orgs). */
export const listMyOrgsForProjectCreation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isFounder = isOwnerFromClaims(context.claims);
    const { data: isMaster } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "master_admin",
    });

    if (isFounder || isMaster) {
      const { data, error } = await supabaseAdmin
        .from("orgs")
        .select("id,name")
        .order("name");
      if (error) throw new Error(error.message);
      return (data ?? []).map((o) => ({ id: o.id, name: o.name, role: "founder" as const }));
    }

    const { data, error } = await context.supabase
      .from("org_members")
      .select("role, org_id, orgs:org_id(id,name)")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return (data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => (r.orgs ? { id: r.orgs.id, name: r.orgs.name, role: "admin" as const } : null))
      .filter((v): v is { id: string; name: string; role: "admin" } => v !== null);
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        orgId: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        siteAddress: z.string().trim().min(1).max(500),
        scopeBrief: z.string().trim().max(4000).optional().default(""),
        masterAdminId: z.string().uuid().optional(),
        projectAdminId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const isFounder = isOwnerFromClaims(context.claims);
    const { data: isMaster } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "master_admin",
    });
    const { data: isOrgAdmin } = await context.supabase.rpc("is_org_admin", {
      _org_id: data.orgId,
      _user_id: context.userId,
    });
    if (!isFounder && !isMaster && !isOrgAdmin) {
      throw new Error("Only the Founder, a Master Admin, or an Organisation Admin can create projects.");
    }

    const { data: project, error } = await context.supabase
      .from("projects")
      .insert({
        org_id: data.orgId,
        name: data.name,
        site_address: data.siteAddress,
        scope_brief: data.scopeBrief || null,
        created_by: context.userId,
        master_admin_id: data.masterAdminId ?? context.userId,
        project_admin_id: data.projectAdminId ?? context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase.from("project_members").insert({
      project_id: project.id,
      user_id: context.userId,
      role_on_project: "project_admin",
    });

    return { id: project.id };
  });

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: p, error } = await supabase
      .from("projects")
      .select(
        "id,name,site_address,scope_brief,master_admin_id,project_admin_id,org_id,created_at,orgs:org_id(id,name)",
      )
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) {
      throw new Error("Access denied — you are not a member of this project.");
    }
    return p;
  });

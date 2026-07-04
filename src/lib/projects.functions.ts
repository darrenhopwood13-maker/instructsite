import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id,name,site_address,scope_brief,master_admin_id,project_admin_id,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    // Dev fallback: self-promote to master_admin if user has no roles yet
    if (!data || data.length === 0) {
      const { error: insErr } = await context.supabase
        .from("user_roles")
        .insert({ user_id: context.userId, role: "master_admin" as any });
      if (!insErr) data = [{ role: "master_admin" }] as any;
    }

    return { userId: context.userId, roles: (data ?? []).map((r: any) => r.role as string) };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        siteAddress: z.string().trim().min(1).max(500),
        scopeBrief: z.string().trim().max(4000).optional().default(""),
        masterAdminId: z.string().uuid().optional(),
        projectAdminId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "master_admin",
    });
    if (!isMaster) throw new Error("Only Master Admins can create projects.");

    const { data: project, error } = await context.supabase
      .from("projects")
      .insert({
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

    // Add creator as project_admin member (idempotent)
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
    const { supabase, userId } = context;
    let { data: p, error } = await supabase
      .from("projects")
      .select("id,name,site_address,scope_brief,master_admin_id,project_admin_id,created_at")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) {
      // Anonymous / non-member session: auto-enroll then retry (Oracle demo access).
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: exists } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("id", data.projectId)
        .maybeSingle();
      if (!exists) throw new Error("Project not found or access denied");
      const { error: insertErr } = await supabaseAdmin
        .from("project_members")
        .insert({ project_id: data.projectId, user_id: userId, role_on_project: "viewer" });
      if (insertErr && !/duplicate|unique/i.test(insertErr.message ?? "")) {
        throw new Error("Project not found or access denied");
      }
      const retry = await supabase
        .from("projects")
        .select("id,name,site_address,scope_brief,master_admin_id,project_admin_id,created_at")
        .eq("id", data.projectId)
        .maybeSingle();
      if (retry.error || !retry.data) throw new Error("Project not found or access denied");
      p = retry.data;
    }
    return p;
  });


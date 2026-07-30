import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerFromClaims } from "@/lib/owner";

export type SessionContext = {
  userId: string;
  email: string;
  fullName: string;
  roles: string[];
  isFounder: boolean;
  org: { id: string; name: string; role: string } | null;
};

export const getSessionContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid().optional() }).optional().parse(i ?? {}),
  )
  .handler(async ({ data, context }): Promise<SessionContext> => {
    const { supabase, userId, claims } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const email = (claims as any)?.email ?? "";
    const isFounder = isOwnerFromClaims(claims);
    const projectId = data?.projectId;

    const [{ data: profile }, { data: rolesRows }, { data: orgRow }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      // Multi-row safe: the founder is a member of every org.
      supabase
        .from("org_members")
        .select("role, org_id, created_at, orgs:org_id(id,name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true }),
    ]);

    const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
    if (isFounder && !roles.includes("master_admin")) roles.push("master_admin");

    // Prefer the membership matching the project in context; otherwise the
    // only membership; otherwise the oldest one.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberships = (orgRow as any[]) ?? [];
    let projectOrgId: string | null = null;
    if (projectId) {
      const { data: p } = await supabase
        .from("projects")
        .select("org_id")
        .eq("id", projectId)
        .maybeSingle();
      projectOrgId = (p?.org_id as string | undefined) ?? null;
    }
    const chosen =
      (projectOrgId && memberships.find((m) => m.org_id === projectOrgId)) ||
      memberships[0] ||
      null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgs = (chosen as any)?.orgs;
    let org: SessionContext["org"] = orgs
      ? { id: orgs.id as string, name: orgs.name as string, role: (chosen as { role: string }).role }
      : null;

    // If no direct org membership but a project is in context, resolve org via the project.
    if (!org && projectId) {
      const { data: proj } = await supabase
        .from("projects")
        .select("org_id, orgs:org_id(id,name)")
        .eq("id", projectId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const po = (proj as any)?.orgs;
      if (po) {
        org = {
          id: po.id as string,
          name: po.name as string,
          role: isFounder ? "founder" : "member",
        };
      }
    }

    const fullName =
      (profile?.full_name && profile.full_name.trim()) ||
      (email ? email.split("@")[0] : "Signed in");

    return { userId, email, fullName, roles, isFounder, org };
  });

import { createServerFn } from "@tanstack/react-start";
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
  .handler(async ({ context }): Promise<SessionContext> => {
    const { supabase, userId, claims } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const email = (claims as any)?.email ?? "";
    const isFounder = isOwnerFromClaims(claims);

    const [{ data: profile }, { data: rolesRows }, { data: orgRow }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("org_members")
        .select("role, org_id, orgs:org_id(id,name)")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const roles = (rolesRows ?? []).map((r: { role: string }) => r.role);
    if (isFounder && !roles.includes("master_admin")) roles.push("master_admin");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orgs = (orgRow as any)?.orgs;
    const org = orgs
      ? { id: orgs.id as string, name: orgs.name as string, role: (orgRow as { role: string }).role }
      : null;

    const fullName =
      (profile?.full_name && profile.full_name.trim()) ||
      (email ? email.split("@")[0] : "Signed in");

    return { userId, email, fullName, roles, isFounder, org };
  });

import { supabase } from "@/integrations/supabase/client";

/**
 * Hard authentication gate. Returns the current signed-in user, or redirects
 * to /auth if there is no session. Never signs the user in anonymously.
 *
 * The returned promise never resolves in the unauthenticated path — the
 * browser navigates away first — so callers can safely assume a user.
 */
export async function ensureOracleSession() {
  const { data, error } = await supabase.auth.getUser();
  if (!error && data?.user?.id) return data.user;

  if (typeof window !== "undefined") {
    const redirect = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    window.location.replace(`/auth?redirect=${redirect}`);
    return await new Promise<never>(() => {});
  }
  throw new Error("Authentication required.");
}

/**
 * Route the signed-in user to the correct workspace based on their role.
 * - master_admin / project_admin  → /projects
 * - site_manager                  → /site-manager (portfolio picker)
 * - subcontractor                 → /projects (their DABS is invite-scoped)
 */
export function routeForRoles(roles: string[]): string {
  if (roles.includes("master_admin") || roles.includes("project_admin")) {
    return "/projects";
  }
  if (roles.includes("site_manager")) return "/projects";
  if (roles.includes("subcontractor")) return "/projects";
  return "/projects";
}

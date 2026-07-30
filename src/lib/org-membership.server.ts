/**
 * Shared org-membership resolution.
 *
 * RLS across the app is built on public.is_org_member(org_id, auth.uid()).
 * The platform owner (master_admin) historically had no org_members row, so
 * every org-scoped read/write failed for them. Rather than widening
 * is_org_member (which would break tenant isolation), we self-heal by
 * creating a real, non-standard membership row for the owner in the org
 * they are acting in.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Ensure the platform owner has an org_members row for `orgId`. */
export async function ensureOwnerMembership(
  supabase: any,
  userId: string,
  orgId: string,
): Promise<void> {
  const { error } = await supabase.rpc("ensure_owner_org_membership", { _org_id: orgId });
  if (!error) return;

  // Fall back to an admin-client insert (e.g. master_admin role row missing).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: insErr } = await supabaseAdmin.from("org_members").insert({
    org_id: orgId,
    user_id: userId,
    role: "admin",
    is_standard: false,
  });
  if (insErr && !/duplicate key/i.test(insErr.message)) {
    throw new Error(`Could not attach owner to organisation: ${insErr.message}`);
  }
}

/**
 * Resolve the org the caller is acting in, self-healing the owner's membership
 * so RLS-scoped queries on the caller's client succeed.
 */
export async function resolveActingOrgId(
  supabase: any,
  userId: string,
  claims?: any,
): Promise<string> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.org_id) return data.org_id as string;

  const { isOwnerFromClaims } = await import("@/lib/owner");
  if (!isOwnerFromClaims(claims)) {
    throw new Error("You are not a member of an organisation.");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: firstOrg } = await supabaseAdmin
    .from("orgs")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!firstOrg?.id) throw new Error("No organisation exists yet. Create one first.");

  await ensureOwnerMembership(supabase, userId, firstOrg.id as string);
  return firstOrg.id as string;
}

/**
 * Shared org-membership resolution.
 *
 * RLS across the app is built on public.is_org_member(org_id, auth.uid()).
 * The platform owner (master_admin) is now a real member of EVERY org (the
 * BUG 1 backfill), so "the user's org" is no longer a single row. Nothing in
 * here may use .single()/.maybeSingle() against org_members — that throws
 * "JSON object requested, multiple (or no) rows returned" for the founder.
 *
 * The acting org is resolved explicitly, in priority order:
 *   1. an explicit orgId supplied by the caller (the selected org)
 *   2. the org that owns the project being acted on
 *   3. the caller's only membership, when they have exactly one
 *   4. last resort: their oldest membership (or the oldest org, for the owner)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface ActingOrgOptions {
  /** Project being acted on — its org wins over any membership guess. */
  projectId?: string | null;
  /** Explicitly selected org (e.g. founder org switcher). */
  orgId?: string | null;
}

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
 * All org ids the caller is a member of, oldest membership first.
 * Multi-row safe by construction — never uses single()/maybeSingle().
 */
export async function listMyOrgIds(supabase: any, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("org_members")
    .select("org_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { org_id: string }) => r.org_id);
}

async function orgIdForProject(projectId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Primary key lookup — exactly one row by definition, so single-row is safe.
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("org_id")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.org_id as string | undefined) ?? null;
}

/**
 * Resolve the org the caller is acting in, self-healing the owner's membership
 * so RLS-scoped queries on the caller's client succeed.
 */
export async function resolveActingOrgId(
  supabase: any,
  userId: string,
  claims?: any,
  opts: ActingOrgOptions = {},
): Promise<string> {
  const { isOwnerFromClaims } = await import("@/lib/owner");
  const isOwner = isOwnerFromClaims(claims);
  const memberships = await listMyOrgIds(supabase, userId);
  const memberOf = new Set(memberships);

  const use = async (orgId: string): Promise<string> => {
    if (!memberOf.has(orgId)) {
      if (!isOwner) throw new Error("You are not a member of that organisation.");
      await ensureOwnerMembership(supabase, userId, orgId);
    }
    return orgId;
  };

  // 1. Explicitly selected org.
  if (opts.orgId) return use(opts.orgId);

  // 2. The org that owns the project being acted on.
  if (opts.projectId) {
    const orgId = await orgIdForProject(opts.projectId);
    if (!orgId) throw new Error("That project no longer exists.");
    return use(orgId);
  }

  // 3. Unambiguous single membership.
  if (memberships.length === 1) return memberships[0];

  // 4. Last resort — oldest membership, then oldest org for a fresh owner.
  if (memberships.length > 1) return memberships[0];

  if (!isOwner) throw new Error("You are not a member of an organisation.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: orgs, error } = await supabaseAdmin
    .from("orgs")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  const firstOrg = orgs?.[0]?.id as string | undefined;
  if (!firstOrg) throw new Error("No organisation exists yet. Create one first.");

  await ensureOwnerMembership(supabase, userId, firstOrg);
  return firstOrg;
}

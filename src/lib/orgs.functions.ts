import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Returns the current user's org + role, or null if not in an org yet. */
export const getMyOrg = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("org_members")
      .select("role, org_id, orgs:org_id (id, name, slug)")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const org = data.orgs as any;
    return { role: data.role as "admin" | "subcontractor", orgId: data.org_id as string, org };
  });

/** All orgs with no admin yet — used by the claim screen. */
export const listClaimableOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orgs, error } = await supabaseAdmin
      .from("orgs")
      .select("id, name, slug")
      .order("name");
    if (error) throw new Error(error.message);
    const { data: admins } = await supabaseAdmin
      .from("org_members")
      .select("org_id")
      .eq("role", "admin");
    const claimed = new Set((admins ?? []).map((r) => r.org_id));
    return (orgs ?? []).filter((o) => !claimed.has(o.id));
  });

/** Claim an unowned org as its admin. First-come-first-served. */
export const claimOrgAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Ensure user isn't already in an org
    const { data: existing } = await context.supabase
      .from("org_members")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) throw new Error("You already belong to an organisation.");

    const { error } = await context.supabase.from("org_members").insert({
      org_id: data.orgId,
      user_id: context.userId,
      role: "admin",
    });
    if (error) {
      if (error.message.includes("ORG_ADMIN_CAP")) {
        throw new Error("This organisation already has an admin.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** Join an org as a subcontractor via a shared link. Cap of 2 enforced by trigger. */
export const joinOrgAsSub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ slug: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org, error: orgErr } = await supabaseAdmin
      .from("orgs")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (orgErr) throw new Error(orgErr.message);
    if (!org) throw new Error("Organisation not found.");

    const { data: existing } = await context.supabase
      .from("org_members")
      .select("id, org_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      if (existing.org_id === org.id) return { ok: true, orgId: org.id };
      throw new Error("You already belong to another organisation.");
    }

    const { error } = await context.supabase.from("org_members").insert({
      org_id: org.id,
      user_id: context.userId,
      role: "subcontractor",
    });
    if (error) {
      if (error.message.includes("ORG_SUB_CAP")) {
        throw new Error("This organisation is full (2 subcontractor seats used).");
      }
      throw new Error(error.message);
    }
    return { ok: true, orgId: org.id };
  });

/** Members of the current user's org (admin sees this on /org). */
export const listOrgMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: me } = await context.supabase
      .from("org_members")
      .select("org_id, role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!me) return { orgId: null, myRole: null, members: [] };

    const { data: members, error } = await context.supabase
      .from("org_members")
      .select("id, user_id, role, created_at")
      .eq("org_id", me.org_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    return { orgId: me.org_id as string, myRole: me.role as string, members: members ?? [] };
  });

export const removeOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ memberId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("org_members")
      .delete()
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

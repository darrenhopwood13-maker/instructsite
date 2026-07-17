import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerFromClaims, slugify } from "@/lib/owner";

/**
 * Send the invite email via Supabase's built-in auth email flow.
 * Uses the default Lovable auth sender — no custom email domain required.
 * - New users: admin.inviteUserByEmail (invite template)
 * - Existing users: resetPasswordForEmail (password-reset template as the magic link)
 * Redirects the recipient to /reset-password?next=/join-org/invite/<token>
 * so they set (or update) a password and then land on the accept page with a session.
 * Failures are logged but never block invite creation — copy-link fallback still works.
 */
async function sendOrgInviteEmail(email: string, token: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const req = getRequest();
    const originHeader =
      req?.headers.get("origin") ||
      (req?.headers.get("host") ? `https://${req.headers.get("host")}` : "");
    const origin = process.env.PUBLIC_SITE_URL || originHeader || "https://instructsite.com";
    const next = `/join-org/invite/${token}`;
    const redirectTo = `${origin.replace(/\/$/, "")}/reset-password?next=${encodeURIComponent(next)}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = supabaseAdmin.auth.admin as any;
    const { error: inviteErr } = await admin.inviteUserByEmail(email, { redirectTo });
    if (!inviteErr) return;

    const msg = String(inviteErr.message || "");
    // Existing user → send password-recovery email (acts as the magic link)
    if (/already|registered|exists/i.test(msg)) {
      const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetErr) console.warn("[orgs] invite reset fallback failed", resetErr.message);
      return;
    }
    console.warn("[orgs] inviteUserByEmail failed", msg);
  } catch (e) {
    console.warn("[orgs] sendOrgInviteEmail threw", e);
  }
}

export type OwnerOrgSummary = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  project_count: number;
  member_count: number;
};

/** Returns the current user's org + role, or null. Founder returns role="owner". */
export const getMyOrg = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (isOwnerFromClaims(context.claims)) {
      return { role: "owner" as const, orgId: null, org: null };
    }
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
  .handler(async () => {
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

export const claimOrgAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
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

/* ============================================================
 * Founder-only functions
 * ============================================================ */

function assertOwner(claims: unknown) {
  if (!isOwnerFromClaims(claims)) throw new Error("Forbidden: founder access required.");
}

export const listAllOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OwnerOrgSummary[]> => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orgs, error } = await supabaseAdmin
      .from("orgs")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const [{ data: projRows }, { data: memRows }] = await Promise.all([
      supabaseAdmin.from("projects").select("org_id"),
      supabaseAdmin.from("org_members").select("org_id"),
    ]);
    const projCount = new Map<string, number>();
    const memCount = new Map<string, number>();
    (projRows ?? []).forEach((r: { org_id: string | null }) => {
      if (r.org_id) projCount.set(r.org_id, (projCount.get(r.org_id) ?? 0) + 1);
    });
    (memRows ?? []).forEach((r: { org_id: string }) => {
      memCount.set(r.org_id, (memCount.get(r.org_id) ?? 0) + 1);
    });

    return (orgs ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      created_at: o.created_at,
      project_count: projCount.get(o.id) ?? 0,
      member_count: memCount.get(o.id) ?? 0,
    }));
  });

export const getOrgById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: org, error } = await supabaseAdmin
      .from("orgs")
      .select("*")
      .eq("id", data.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!org) throw new Error("Organisation not found.");
    return org;
  });

export const listOrgProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: projects, error } = await supabaseAdmin
      .from("projects")
      .select("id, name, site_address, scope_brief, created_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return projects ?? [];
  });

export const listOrgMembersFor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: members, error } = await supabaseAdmin
      .from("org_members")
      .select("id, user_id, role, created_at")
      .eq("org_id", data.orgId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return members ?? [];
  });

const inviteRowSchema = z.object({
  email: z.string().trim().email().max(200),
  role: z.enum(["admin", "subcontractor"]),
});

const createOrgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9-]*$/, "Slug can only contain lowercase letters, numbers, and dashes")
    .optional()
    .default(""),
  companyNumber: z.string().trim().max(60).optional().default(""),
  contactName: z.string().trim().max(120).optional().default(""),
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .optional()
    .default("")
    .refine((v) => !v || /.+@.+\..+/.test(v), "Invalid email"),
  contactPhone: z.string().trim().max(40).optional().default(""),
  registeredAddress: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  invites: z.array(inviteRowSchema).max(10).optional().default([]),
});

export const createOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createOrgSchema.parse(i))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let slug = data.slug && data.slug.length >= 2 ? data.slug : slugify(data.name);
    if (!slug) throw new Error("Could not derive a slug from the name. Provide one manually.");

    const base = slug;
    for (let i = 2; i < 50; i += 1) {
      const { data: existing } = await supabaseAdmin
        .from("orgs")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (!existing) break;
      slug = `${base}-${i}`;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("orgs")
      .insert({
        name: data.name,
        slug,
        created_by: context.userId,
        company_number: data.companyNumber || null,
        contact_name: data.contactName || null,
        contact_email: data.contactEmail || null,
        contact_phone: data.contactPhone || null,
        registered_address: data.registeredAddress || null,
        notes: data.notes || null,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    // Enforce the 1-PM + 2-Sub standard cap on the invites payload
    const pmCount = data.invites.filter((r) => r.role === "admin").length;
    const subCount = data.invites.filter((r) => r.role === "subcontractor").length;
    if (pmCount > 1) throw new Error("Only 1 Project Manager can be invited as a standard seat.");
    if (subCount > 2) throw new Error("Only 2 Subcontractors can be invited as standard seats.");

    if (data.invites.length > 0) {
      const rows = data.invites.map((r) => ({
        org_id: inserted.id,
        email: r.email.toLowerCase(),
        role: r.role,
        is_standard: true,
        invited_by: context.userId,
      }));
      const { data: insertedInvites, error: invErr } = await supabaseAdmin
        .from("org_invites")
        .insert(rows)
        .select("email, token");
      if (invErr) throw new Error(invErr.message);
      await Promise.all(
        (insertedInvites ?? []).map((i) =>
          sendOrgInviteEmail(i.email as string, i.token as string),
        ),
      );
    }

    return { orgId: inserted.id as string, slug: inserted.slug as string };
  });


const updateOrgSchema = createOrgSchema.extend({
  orgId: z.string().uuid(),
});

export const updateOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => updateOrgSchema.parse(i))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let slug = data.slug && data.slug.length >= 2 ? data.slug : slugify(data.name);
    if (!slug) throw new Error("Could not derive a slug from the name. Provide one manually.");

    // Ensure uniqueness (excluding current row)
    const base = slug;
    for (let i = 2; i < 50; i += 1) {
      const { data: existing } = await supabaseAdmin
        .from("orgs")
        .select("id")
        .eq("slug", slug)
        .neq("id", data.orgId)
        .maybeSingle();
      if (!existing) break;
      slug = `${base}-${i}`;
    }

    const { error } = await supabaseAdmin
      .from("orgs")
      .update({
        name: data.name,
        slug,
        company_number: data.companyNumber || null,
        contact_name: data.contactName || null,
        contact_email: data.contactEmail || null,
        contact_phone: data.contactPhone || null,
        registered_address: data.registeredAddress || null,
        notes: data.notes || null,
      })
      .eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { orgId: data.orgId, slug };
  });

/* ============================================================
 * Invites & additional members
 * ============================================================ */

export type OrgInviteRow = {
  id: string;
  email: string;
  role: "admin" | "subcontractor";
  is_standard: boolean;
  status: "pending" | "accepted" | "revoked";
  token: string;
  created_at: string;
  accepted_at: string | null;
};

export const listOrgInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<OrgInviteRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!isOwnerFromClaims(context.claims)) {
      // Non-founder: must be org admin
      const { data: me } = await context.supabase
        .from("org_members")
        .select("role")
        .eq("org_id", data.orgId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!me || me.role !== "admin") throw new Error("Forbidden");
    }
    const { data: rows, error } = await supabaseAdmin
      .from("org_invites")
      .select("id, email, role, is_standard, status, token, created_at, accepted_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as OrgInviteRow[];
  });

const inviteMemberSchema = z.object({
  orgId: z.string().uuid(),
  email: z.string().trim().email().max(200),
  role: z.enum(["admin", "subcontractor"]),
});

export const inviteOrgMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => inviteMemberSchema.parse(i))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Count standard members + pending standard invites
    const [{ data: members }, { data: invites }] = await Promise.all([
      supabaseAdmin
        .from("org_members")
        .select("role, is_standard")
        .eq("org_id", data.orgId),
      supabaseAdmin
        .from("org_invites")
        .select("role, is_standard, status")
        .eq("org_id", data.orgId)
        .eq("status", "pending"),
    ]);

    const stdPM =
      (members ?? []).filter((m) => m.role === "admin" && m.is_standard).length +
      (invites ?? []).filter((i) => i.role === "admin" && i.is_standard).length;
    const stdSub =
      (members ?? []).filter((m) => m.role === "subcontractor" && m.is_standard).length +
      (invites ?? []).filter((i) => i.role === "subcontractor" && i.is_standard).length;

    const stdComplete = stdPM >= 1 && stdSub >= 2;
    const isStandard = !stdComplete;

    if (isStandard) {
      if (data.role === "admin" && stdPM >= 1) {
        throw new Error("Standard Project Manager seat already used. Fill the remaining subcontractor seats first, then add additional members.");
      }
      if (data.role === "subcontractor" && stdSub >= 2) {
        throw new Error("Both standard subcontractor seats are taken.");
      }
    }
    // additional members are always allowed once std complete

    const { data: inserted, error } = await supabaseAdmin
      .from("org_invites")
      .insert({
        org_id: data.orgId,
        email: data.email.toLowerCase(),
        role: data.role,
        is_standard: isStandard,
        invited_by: context.userId,
      })
      .select("id, token")
      .single();
    if (error) throw new Error(error.message);
    return { inviteId: inserted.id as string, token: inserted.token as string, isStandard };
  });

export const revokeOrgInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ inviteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("org_invites")
      .update({ status: "revoked" })
      .eq("id", data.inviteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getInviteByToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ token: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv, error } = await supabaseAdmin
      .from("org_invites")
      .select("id, email, role, status, org_id, orgs:org_id(name, slug)")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invite not found");
    return inv;
  });

export const acceptOrgInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ token: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("accept_org_invite", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = Array.isArray(result) ? (result[0] as any) : (result as any);
    return { orgId: row?.org_id as string, role: row?.role as string };
  });


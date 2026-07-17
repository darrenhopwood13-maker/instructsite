import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerFromClaims, slugify } from "@/lib/owner";

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
});

export const createOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createOrgSchema.parse(i))
  .handler(async ({ data, context }) => {
    assertOwner(context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let slug = data.slug && data.slug.length >= 2 ? data.slug : slugify(data.name);
    if (!slug) throw new Error("Could not derive a slug from the name. Provide one manually.");

    // Ensure uniqueness — append -2, -3, … if taken
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

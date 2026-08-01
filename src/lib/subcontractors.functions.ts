import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // base64url
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Hard server-side gate: only project_admin (for this project) or master_admin
 * may create subcontractor records or mint invite tokens. A site_manager is
 * explicitly NOT allowed, and the check cannot be bypassed from the client.
 */
async function assertProjectAdmin(supabase: any, projectId: string, userId: string) {
  const [{ data: isAdmin, error }, { data: isMaster }] = await Promise.all([
    supabase.rpc("is_project_admin", { _project_id: projectId, _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "master_admin" }),
  ]);
  if (error) throw new Error(error.message);
  if (!isAdmin && !isMaster) {
    throw new Error("Forbidden: project_admin or master_admin role required.");
  }
}


export const createSubcontractorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        companyName: z.string().trim().min(1).max(200),
        tradePackages: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
        seatRole: z.enum(["admin", "read_only"]).default("read_only"),
        registeredAddress: z.string().trim().max(500).optional().nullable(),
        officePhone: z.string().trim().max(40).optional().nullable(),
        corporateEmail: z.string().trim().email().max(200).optional().nullable().or(z.literal("")),
        pmName: z.string().trim().max(120).optional().nullable(),
        pmMobile: z.string().trim().max(40).optional().nullable(),
        pmEmail: z.string().trim().email().max(200).optional().nullable().or(z.literal("")),
        supervisorName: z.string().trim().max(120).optional().nullable(),
        supervisorMobile: z.string().trim().max(40).optional().nullable(),
        supervisorEmail: z.string().trim().email().max(200).optional().nullable().or(z.literal("")),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const emptyToNull = (v?: string | null) => (v && v.trim() ? v.trim() : null);
    const { data: row, error } = await context.supabase
      .from("subcontractor_invites")
      .insert({
        project_id: data.projectId,
        company_name: data.companyName,
        trade_packages: data.tradePackages,
        seat_role: data.seatRole,
        token_hash: tokenHash,
        created_by: context.userId,
        registered_address: emptyToNull(data.registeredAddress),
        office_phone: emptyToNull(data.officePhone),
        corporate_email: emptyToNull(data.corporateEmail),
        pm_name: emptyToNull(data.pmName),
        pm_mobile: emptyToNull(data.pmMobile),
        pm_email: emptyToNull(data.pmEmail),
        supervisor_name: emptyToNull(data.supervisorName),
        supervisor_mobile: emptyToNull(data.supervisorMobile),
        supervisor_email: emptyToNull(data.supervisorEmail),
      })
      .select("id, expires_at")
      .single();
    if (error) {
      const m = error.message || "";
      if (m.includes("SEAT_CAP_ADMIN")) {
        throw new Error("Maximum Capacity Reached · This subcontractor already has an admin seat.");
      }
      if (m.includes("SEAT_CAP_READONLY")) {
        throw new Error("Maximum Capacity Reached · 2 read-only seats already assigned.");
      }
      if (m.includes("SEAT_CAP_TOTAL")) {
        throw new Error(
          "Maximum Capacity Reached · 3 seats per subcontractor (1 admin + 2 read-only).",
        );
      }
      throw new Error(error.message);
    }
    return { id: row.id, token, expiresAt: row.expires_at };
  });

export const listSubcontractorInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // RLS on subcontractor_invites already restricts to project admins, so we
    // don't need the extra assertProjectAdmin gate here — that duplicate check
    // was masking legitimate reads when the founder's client hadn't yet
    // registered against the RPC. Filter out revoked rows for the panel.
    const { data: rows, error } = await context.supabase
      .from("subcontractor_invites")
      .select(
        "id, company_name, trade_packages, accepted_by, accepted_at, revoked_at, expires_at, created_at, package_manager_id, seat_role, corporate_email, pm_email, supervisor_email, pm_name",
      )
      .eq("project_id", data.projectId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const revokeSubcontractorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ inviteId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: inv, error: gErr } = await context.supabase
      .from("subcontractor_invites")
      .select("project_id")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!inv) throw new Error("Invite not found.");
    await assertProjectAdmin(context.supabase, inv.project_id, context.userId);
    const { error } = await context.supabase
      .from("subcontractor_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.inviteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptSubcontractorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ token: z.string().min(8).max(200) }).parse(i))
  .handler(async ({ data, context }) => {
    const tokenHash = await sha256Hex(data.token);
    const { data: rows, error } = await context.supabase.rpc(
      "accept_subcontractor_invite" as never,
      { _token_hash: tokenHash } as never,
    );
    if (error) throw new Error(error.message);
    const first = (rows as any[])?.[0];
    if (!first) throw new Error("Invite could not be accepted.");
    return {
      projectId: first.project_id as string,
      tradePackages: (first.trade_packages ?? []) as string[],
    };
  });

export const getMyProjectContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const email = (context.claims as any)?.email as string | undefined;
    const { data: inv } = await context.supabase
      .from("subcontractor_invites")
      .select("company_name, trade_packages, accepted_at")
      .eq("project_id", data.projectId)
      .eq("accepted_by", context.userId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: proj } = await context.supabase
      .from("projects")
      .select("name, project_number, site_address")
      .eq("id", data.projectId)
      .maybeSingle();
    return {
      email: email ?? null,
      projectName: proj?.name ?? null,
      projectNumber: (proj as any)?.project_number ?? null,
      siteAddress: (proj as any)?.site_address ?? null,
      companyName: inv?.company_name ?? null,
      tradePackages: (inv?.trade_packages ?? []) as string[],
    };
  });

// =========================================================
// PACKAGE MANAGER ASSIGNMENT
// =========================================================

export const listProjectSiteManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const { data: rows, error } = await context.supabase.rpc(
      "list_project_site_managers" as never,
      { _project_id: data.projectId } as never,
    );
    if (error) throw new Error(error.message);
    return (rows ?? []) as { user_id: string; full_name: string | null }[];
  });

export const listUnassignedSiteManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const { data: rows, error } = await context.supabase.rpc(
      "list_unassigned_site_managers" as never,
      { _project_id: data.projectId } as never,
    );
    if (error) throw new Error(error.message);
    return (rows ?? []) as { user_id: string; full_name: string | null }[];
  });

export const addSiteManagerToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid(), userId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const { error } = await context.supabase.rpc(
      "add_site_manager_to_project" as never,
      {
        _project_id: data.projectId,
        _user_id: data.userId,
      } as never,
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignPackageManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        inviteId: z.string().uuid(),
        // null clears the assignment
        packageManagerId: z.string().uuid().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: inv, error: gErr } = await context.supabase
      .from("subcontractor_invites")
      .select("project_id")
      .eq("id", data.inviteId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!inv) throw new Error("Package not found.");
    await assertProjectAdmin(context.supabase, inv.project_id, context.userId);

    if (data.packageManagerId) {
      // Confirm the chosen user is actually a site manager on this project
      // before assigning — belt-and-braces alongside the RLS/RPC checks.
      const { data: eligible } = await context.supabase.rpc(
        "list_project_site_managers" as never,
        { _project_id: inv.project_id } as never,
      );
      const ok = ((eligible ?? []) as { user_id: string }[]).some(
        (m) => m.user_id === data.packageManagerId,
      );
      if (!ok) {
        throw new Error("Selected user is not a Site Manager on this project.");
      }
    }

    const { error } = await (context.supabase as any)
      .from("subcontractor_invites")
      .update({ package_manager_id: data.packageManagerId })
      .eq("id", data.inviteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** Best invite contact for a subcontractor row. */
function inviteEmailOf(inv: {
  corporate_email?: string | null;
  pm_email?: string | null;
  supervisor_email?: string | null;
}): string | null {
  return inv.corporate_email || inv.pm_email || inv.supervisor_email || null;
}

/**
 * Mint a fresh join link for a pending invite (the stored token is hashed and
 * cannot be recovered, so copying or resending always rotates it) and
 * optionally email it to the subcontractor's contact address.
 */
export const refreshSubcontractorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ inviteId: z.string().uuid(), resendEmail: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: inv, error: gErr } = await context.supabase
      .from("subcontractor_invites")
      .select(
        "id, project_id, company_name, accepted_at, revoked_at, corporate_email, pm_email, supervisor_email",
      )
      .eq("id", data.inviteId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!inv) throw new Error("Invite not found.");
    await assertProjectAdmin(context.supabase, inv.project_id, context.userId);
    if (inv.revoked_at) throw new Error("That invite has been revoked — create a new one.");
    if (inv.accepted_at) throw new Error("That invite has already been accepted.");

    const token = randomToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const { error } = await context.supabase
      .from("subcontractor_invites")
      .update({ token_hash: tokenHash, expires_at: expiresAt })
      .eq("id", data.inviteId);
    if (error) throw new Error(error.message);

    const email = inviteEmailOf(inv);
    let emailed = false;
    let emailError: string | null = null;
    if (data.resendEmail) {
      if (!email) {
        emailError = "No contact email on this invite — copy the link and send it manually.";
      } else {
        const { sendInviteEmail } = await import("@/lib/invite-email.server");
        const res = await sendInviteEmail(email, `/invite/${token}`);
        emailed = res.sent;
        emailError = res.sent ? null : (res.reason ?? "Email send failed.");
      }
    }

    return { token, expiresAt, email, emailed, emailError };
  });

/**
 * Invite a Site Manager onto the project by email. The account is granted the
 * site_manager role and project membership immediately so the Package Manager
 * pickers are usable straight away; the invitee gets a magic link to set up.
 */
export const inviteSiteManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        email: z.string().trim().email().max(200),
        fullName: z.string().trim().max(120).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const email = data.email.toLowerCase();
    const nextPath = `/projects/${data.projectId}`;

    const { sendInviteEmail, findAuthUserByEmail } = await import("@/lib/invite-email.server");
    const sendResult = await sendInviteEmail(email, nextPath);

    const user = await findAuthUserByEmail(email);
    if (!user) {
      return {
        ok: sendResult.sent,
        emailed: sendResult.sent,
        emailError: sendResult.reason ?? null,
        attached: false,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "site_manager" }, { onConflict: "user_id,role" });
    // project_members is unique on (project_id, user_id, role_on_project) — insert
    // only when this exact membership row is missing.
    const { data: existingMember } = await supabaseAdmin
      .from("project_members")
      .select("id")
      .eq("project_id", data.projectId)
      .eq("user_id", user.id)
      .eq("role_on_project", "site_manager")
      .limit(1);
    if (!existingMember || existingMember.length === 0) {
      const { error: memberErr } = await supabaseAdmin
        .from("project_members")
        .insert({ project_id: data.projectId, user_id: user.id, role_on_project: "site_manager" });
      if (memberErr && !/duplicate key/i.test(memberErr.message)) {
        throw new Error(memberErr.message);
      }
    }
    if (data.fullName?.trim()) {
      await supabaseAdmin
        .from("profiles")
        .upsert(
          { user_id: user.id, full_name: data.fullName.trim() },
          { onConflict: "user_id" },
        );
    }

    return {
      ok: true,
      emailed: sendResult.sent,
      emailError: sendResult.reason ?? null,
      attached: true,
    };
  });

// =========================================================
// QUANTITY SURVEYOR (QS)
// =========================================================

export const listProjectQs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("project_members")
      .select("user_id")
      .eq("project_id", data.projectId)
      .eq("role_on_project", "qs");
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.user_id);
    if (ids.length === 0)
      return [] as { user_id: string; full_name: string | null; email: string | null }[];
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    const nameOf = new Map((profs ?? []).map((p) => [p.user_id, p.full_name]));
    // Emails live in auth, not profiles, so resolve them one by one (a project
    // only ever carries a handful of QS seats).
    const emails = await Promise.all(
      ids.map(async (id) => {
        try {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
          return [id, u?.user?.email ?? null] as const;
        } catch {
          return [id, null] as const;
        }
      }),
    );
    const emailOf = new Map(emails);
    return ids.map((id) => ({
      user_id: id,
      full_name: nameOf.get(id) ?? null,
      email: emailOf.get(id) ?? null,
    }));
  });

export const listUnassignedQs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: qsRoles, error }, { data: members }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "qs"),
      supabaseAdmin.from("project_members").select("user_id").eq("project_id", data.projectId),
    ]);
    if (error) throw new Error(error.message);
    const assigned = new Set((members ?? []).map((m) => m.user_id));
    const ids = (qsRoles ?? []).map((r) => r.user_id).filter((id) => !assigned.has(id));
    if (ids.length === 0) return [] as { user_id: string; full_name: string | null }[];
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", ids);
    const nameOf = new Map((profs ?? []).map((p) => [p.user_id, p.full_name]));
    return ids.map((id) => ({ user_id: id, full_name: nameOf.get(id) ?? null }));
  });

/**
 * Invite a Quantity Surveyor onto the project by email. Mirrors
 * inviteSiteManager exactly, but grants the qs role and lands the invitee on
 * the QS workspace for the project.
 */
export const inviteQs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        email: z.string().trim().email().max(200),
        fullName: z.string().trim().max(120).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const email = data.email.toLowerCase();
    const nextPath = `/qs/${data.projectId}`;

    const { sendInviteEmail, findAuthUserByEmail } = await import("@/lib/invite-email.server");

    // Duplicate guard: if this email already exists and is already a QS on
    // this project, say so politely instead of re-inviting or erroring.
    const existingUser = await findAuthUserByEmail(email);
    if (existingUser) {
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      const { data: already } = await admin
        .from("project_members")
        .select("id")
        .eq("project_id", data.projectId)
        .eq("user_id", existingUser.id)
        .eq("role_on_project", "qs")
        .limit(1);
      if (already && already.length > 0) {
        return {
          ok: true,
          emailed: false,
          emailError: null,
          attached: true,
          alreadyInvited: true as const,
        };
      }
    }

    const sendResult = await sendInviteEmail(email, nextPath);

    const user = existingUser;
    if (!user) {
      return {
        ok: sendResult.sent,
        emailed: sendResult.sent,
        emailError: sendResult.reason ?? null,
        attached: false,
      };
    }

    if (!user) {
      return {
        ok: sendResult.sent,
        emailed: sendResult.sent,
        emailError: sendResult.reason ?? null,
        attached: false,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "qs" }, { onConflict: "user_id,role" });
    const { data: existingMember } = await supabaseAdmin
      .from("project_members")
      .select("id")
      .eq("project_id", data.projectId)
      .eq("user_id", user.id)
      .eq("role_on_project", "qs")
      .limit(1);
    if (!existingMember || existingMember.length === 0) {
      const { error: memberErr } = await supabaseAdmin
        .from("project_members")
        .insert({ project_id: data.projectId, user_id: user.id, role_on_project: "qs" });
      if (memberErr && !/duplicate key/i.test(memberErr.message)) {
        throw new Error(memberErr.message);
      }
    }
    if (data.fullName?.trim()) {
      await supabaseAdmin
        .from("profiles")
        .upsert({ user_id: user.id, full_name: data.fullName.trim() }, { onConflict: "user_id" });
    }

    return {
      ok: true,
      emailed: sendResult.sent,
      emailError: sendResult.reason ?? null,
      attached: true,
    };
  });

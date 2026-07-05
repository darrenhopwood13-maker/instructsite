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

async function assertProjectAdmin(supabase: any, projectId: string, userId: string) {
  const { data, error } = await supabase.rpc("is_project_admin", {
    _project_id: projectId,
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Project admin role required.");
}

export const createSubcontractorInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        companyName: z.string().trim().min(1).max(200),
        tradePackages: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
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
    if (error) throw new Error(error.message);
    return { id: row.id, token, expiresAt: row.expires_at };
  });


export const listSubcontractorInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertProjectAdmin(context.supabase, data.projectId, context.userId);
    const { data: rows, error } = await context.supabase
      .from("subcontractor_invites")
      .select("id, company_name, trade_packages, accepted_by, accepted_at, revoked_at, expires_at, created_at")
      .eq("project_id", data.projectId)
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
      .select("name")
      .eq("id", data.projectId)
      .maybeSingle();
    return {
      email: email ?? null,
      projectName: proj?.name ?? null,
      companyName: inv?.company_name ?? null,
      tradePackages: (inv?.trade_packages ?? []) as string[],
    };
  });


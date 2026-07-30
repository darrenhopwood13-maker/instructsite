/**
 * Shared invite-email plumbing.
 *
 * Server-only. Sends the magic link that gets an invited person onto the
 * platform and back to `nextPath` once they have set a password.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { getRequest } from "@tanstack/react-start/server";

export function publicOrigin(): string {
  const req = getRequest();
  const originHeader =
    req?.headers.get("origin") ||
    (req?.headers.get("host") ? `https://${req.headers.get("host")}` : "");
  const origin = process.env.PUBLIC_SITE_URL || originHeader || "https://instructsite.com";
  return origin.replace(/\/$/, "");
}

export type InviteEmailResult = { sent: boolean; reason?: string };

/** Invite (or re-invite) an email address, landing them on `nextPath`. */
export async function sendInviteEmail(
  email: string,
  nextPath: string,
): Promise<InviteEmailResult> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const redirectTo = `${publicOrigin()}/reset-password?next=${encodeURIComponent(nextPath)}`;

    const admin = supabaseAdmin.auth.admin as any;
    const { error: inviteErr } = await admin.inviteUserByEmail(email, { redirectTo });
    if (!inviteErr) return { sent: true };

    const msg = String(inviteErr.message || "");
    if (/already|registered|exists/i.test(msg)) {
      // Existing account — a recovery link doubles as the sign-in link.
      const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetErr) return { sent: false, reason: resetErr.message };
      return { sent: true };
    }
    return { sent: false, reason: msg };
  } catch (e) {
    return { sent: false, reason: (e as Error)?.message ?? "Email send failed." };
  }
}

/** Find an existing auth user by email address (case-insensitive). */
export async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = (data?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === wanted);
    if (hit) return { id: hit.id as string };
    if ((data?.users ?? []).length < 200) break;
  }
  return null;
}

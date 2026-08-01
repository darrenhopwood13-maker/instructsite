/**
 * Server-only notification fan-out.
 *
 * Writes in-app rows into `notifications` with the service-role client (the
 * same approach `project-bible.functions.ts` already uses), and — best effort
 * only — enqueues a matching transactional email onto the existing
 * `transactional_emails` pgmq queue via the `enqueue_email` RPC, using exactly
 * the payload shape `src/routes/lovable/email/queue/process.ts` consumes.
 *
 * The email side is entirely wrapped in try/catch: a queueing failure must
 * never fail or roll back the action that raised the notification, and the
 * in-app notification must still be written.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const SENDER_DOMAIN = "notify.instructsite.com";
const FROM_ADDRESS = `instructSite <notifications@${SENDER_DOMAIN}>`;

export type NotifyRecipient = { userId: string; email?: string | null };

export type NotifyInput = {
  recipients: NotifyRecipient[];
  projectId: string | null;
  kind: string;
  title: string;
  body: string;
  linkTo?: string | null;
  /** Stable key so a retry of the same event doesn't double-send. */
  idempotencyBase: string;
  /** Optional richer body used for the email only. Falls back to `body`. */
  emailParagraphs?: string[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(title: string, paragraphs: string[], linkUrl: string | null): string {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1f2933;">${escapeHtml(
          p,
        )}</p>`,
    )
    .join("");
  const cta = linkUrl
    ? `<p style="margin:22px 0 0;"><a href="${escapeHtml(
        linkUrl,
      )}" style="display:inline-block;background:#0b1220;color:#ffffff;text-decoration:none;padding:11px 18px;border-radius:6px;font-size:14px;">Open in instructSite</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:28px 24px;">
  <p style="margin:0 0 6px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6b7280;">instructSite</p>
  <h1 style="margin:0 0 18px;font-size:19px;line-height:1.3;color:#0b1220;">${escapeHtml(title)}</h1>
  ${body}
  ${cta}
</div></body></html>`;
}

function randomToken(): string {
  return (
    globalThis.crypto?.randomUUID?.().replace(/-/g, "") ??
    Math.random().toString(36).slice(2) + Date.now().toString(36)
  );
}

function publicOrigin(): string {
  const origin = process.env.PUBLIC_SITE_URL || "https://instructsite.com";
  return origin.replace(/\/$/, "");
}

/**
 * Raise an in-app notification for every recipient, and (best effort) an
 * email for every recipient that has an address.
 */
export async function notifyUsers(input: NotifyInput): Promise<{ notified: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const seen = new Set<string>();
  const recipients = input.recipients.filter((r) => {
    if (!r?.userId || seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });
  if (recipients.length === 0) return { notified: 0 };

  // 1) In-app notifications — these are the guaranteed channel.
  const rows = recipients.map((r) => ({
    user_id: r.userId,
    project_id: input.projectId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    link_to: input.linkTo ?? null,
  }));
  const { error: notifErr } = await supabaseAdmin.from("notifications").insert(rows as any);
  if (notifErr) console.error("notifyUsers: in-app insert failed", notifErr);

  // 2) Emails — strictly best effort, never allowed to throw upward.
  try {
    const withEmail = recipients.filter(
      (r) => typeof r.email === "string" && r.email.includes("@"),
    );
    if (withEmail.length > 0) {
      const addresses = withEmail.map((r) => (r.email as string).toLowerCase());

      // Honour the suppression list the processor also respects.
      const { data: suppressed } = await supabaseAdmin
        .from("suppressed_emails")
        .select("email")
        .in("email", addresses);
      const blocked = new Set(
        (suppressed ?? []).map((s: any) => String(s.email).toLowerCase()),
      );

      const linkUrl = input.linkTo ? `${publicOrigin()}${input.linkTo}` : null;
      const paragraphs = input.emailParagraphs?.length
        ? input.emailParagraphs
        : [input.body];
      const html = buildEmailHtml(input.title, paragraphs, linkUrl);
      const text = [input.title, "", ...paragraphs, linkUrl ? `\n${linkUrl}` : ""]
        .join("\n")
        .trim();

      for (const r of withEmail) {
        const to = (r.email as string).toLowerCase();
        if (blocked.has(to)) continue;
        try {
          // Unsubscribe token, same table the unsubscribe route validates.
          const unsubscribeToken = randomToken();
          await supabaseAdmin
            .from("email_unsubscribe_tokens")
            .insert({ token: unsubscribeToken, email: to } as any);

          const messageId = randomToken();
          await supabaseAdmin.rpc("enqueue_email" as never, {
            queue_name: "transactional_emails",
            payload: {
              message_id: messageId,
              label: input.kind,
              to,
              from: FROM_ADDRESS,
              sender_domain: SENDER_DOMAIN,
              subject: input.title,
              html,
              text,
              purpose: "transactional",
              idempotency_key: `${input.idempotencyBase}:${r.userId}`,
              unsubscribe_token: unsubscribeToken,
              queued_at: new Date().toISOString(),
            },
          } as never);
        } catch (perRecipient) {
          console.error("notifyUsers: email enqueue failed", perRecipient);
        }
      }
    }
  } catch (e) {
    console.error("notifyUsers: email side failed (notifications still written)", e);
  }

  return { notified: recipients.length };
}

/**
 * Resolve the people who should hear about a decision on a project diary:
 * the project's site managers, the project admin and master admin on the
 * projects row, plus the diary's subcontractor. The acting user is excluded
 * and the list is de-duplicated. Email addresses come from auth.
 */
export async function resolveProjectDecisionRecipients(opts: {
  projectId: string;
  subcontractorId?: string | null;
  excludeUserId?: string | null;
}): Promise<NotifyRecipient[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const ids = new Set<string>();
  const [{ data: proj }, { data: members }] = await Promise.all([
    supabaseAdmin
      .from("projects")
      .select("master_admin_id, project_admin_id")
      .eq("id", opts.projectId)
      .maybeSingle(),
    supabaseAdmin
      .from("project_members")
      .select("user_id, role_on_project")
      .eq("project_id", opts.projectId)
      .eq("role_on_project", "site_manager"),
  ]);

  for (const m of (members ?? []) as any[]) if (m?.user_id) ids.add(m.user_id);
  if ((proj as any)?.master_admin_id) ids.add((proj as any).master_admin_id);
  if ((proj as any)?.project_admin_id) ids.add((proj as any).project_admin_id);
  if (opts.subcontractorId) ids.add(opts.subcontractorId);
  if (opts.excludeUserId) ids.delete(opts.excludeUserId);

  const out: NotifyRecipient[] = [];
  for (const userId of ids) {
    let email: string | null = null;
    try {
      const { data } = await (supabaseAdmin.auth.admin as any).getUserById(userId);
      email = data?.user?.email ?? null;
    } catch {
      email = null;
    }
    out.push({ userId, email });
  }
  return out;
}

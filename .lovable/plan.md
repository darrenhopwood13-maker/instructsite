## What's actually happening

**1. No email is being sent.**
When you invite a PM from the New Organisation form (or from the org edit page), the code only inserts a row into `org_invites` with a token and gives you a "copy link". There is no email delivery wired up anywhere — that's why nothing lands in the invitee's inbox. This matches what I told you last time; we never actually built the sender.

**2. There is no global password.**
The app uses standard email + password auth (per user). Each person sets their own password when they sign up. So when your PM opens the invite link:

- If they don't have an account yet → they need to hit **Sign up** on `/auth` and choose their own password.
- If they already have an account → they sign in with their existing password.
- Then the invite page calls `accept_org_invite` and drops them into the org.

You didn't miss a step — there was never a shared password. The confusion is just that the invite page doesn't currently walk them through "create an account first, then come back".

## The plan

### A. Wire up automated invite emails (Lovable Emails)

1. Confirm the project's email domain is ready (`check_email_domain_status`). If no domain is configured, show the email setup dialog first — the user needs a domain they own before anything can send.
2. Run `setup_email_infra` (queues, cron, tables) if not already done.
3. Run `scaffold_transactional_email` to get the send route + template registry.
4. Add a branded `org-invite` React Email template in `src/lib/email-templates/` with:
  - Org name, inviter name, role (PM / Subcontractor)
  - Big "Accept invitation" button → `https://<site>/join-org/invite/<token>`
  - Short note: "You'll be asked to sign in or create an account with this email address."
5. Register it in `src/lib/email-templates/registry.ts`.
6. In `orgs.functions.ts`, after inserting an invite row (both in `createOrg`'s bulk insert path and in `inviteOrgMember`), POST to `/lovable/email/transactional/send` with `templateName: "org-invite"`, the invitee's email, and an idempotency key of the invite id. Failures don't roll back the invite — we just log; the Copy Link fallback still works.

### B. Fix the invitee experience so the password step is obvious

On `/join-org/invite/$token`, when there is no session:

- Show a clear panel: "You've been invited as **Project Manager** of &nbsp;. Sign in or create an account with &nbsp; to accept."
- Two buttons: **Sign in** and **Create account**, both linking to `/auth?mode=signin|signup&next=<current-url>&email=<invited-email>`.

On `/auth`:

- Read `next` and `email` from the query string.
- Prefill the email field (read-only hint acceptable) and, on successful sign-in or sign-up, navigate to `next` instead of `/`.
- Keep the current password + Google flow; no schema changes.

### C. Communicate the "no global password" reality in the UI

Small helper text on the New Organisation form under the invite email fields:

> "Invitees receive an email with a link. They sign in with their own password (or create one on first use) — there is no shared password."

## Not doing

- No changes to `org_invites`, RLS, or `accept_org_invite` — the accept flow itself works.
- Not switching to magic-link / passwordless. If you'd rather invitees skip choosing a password entirely, say so and I'll swap the invite email for a Supabase magic-link instead (separate plan).

## Confirm before I build

1. OK to send invite emails through **Lovable Emails** (requires a verified sender domain on the project — I'll check status first and prompt setup if missing)? ok 
2. Keep **email + password** signup for invitees, or do you want magic-link instead? magic link then set password
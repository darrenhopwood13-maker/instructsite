
## Heads-up before I start

You mentioned the tables `snag_projects`, `snags`, `snag_comments`, the `snag-photos` bucket, and RLS policies are already in place. I checked the database — **none of those exist yet**. No `orgs` table either, and no `org_id` column on `profiles`/`projects`. So I'll create all of it from scratch as part of this plan. If you already have SQL you wanted me to run, paste it and I'll fold it in.

Also: this project runs on **TanStack Start**, not Vercel. There is no `/api/instruct-snag` Vercel function. I'll build the AI endpoint in-project as agreed.

---

## 1. Database — multi-tenant foundation + snag tables

Single migration:

- `orgs` table: `id`, `name`, `slug`, `created_by`, timestamps.
- `org_members` table: `(org_id, user_id, role)` where role ∈ `admin` | `subcontractor`. Unique on `(org_id, user_id)`.
- Add nullable `org_id uuid` to `profiles` and `projects` (existing rows untouched).
- New `app_role` value: `snag_admin` (optional, keeps existing role system clean).
- `snag_projects`: `id`, `org_id`, `name`, `site_address`, `created_by`, timestamps.
- `snags`: `id`, `org_id`, `snag_project_id`, `photo_path` (storage key in `snag-photos`), `defect_title`, `description`, `cause`, `rectification_option_a`, `rectification_option_b`, `tradesman_hack`, `regulatory_citations jsonb`, `hs_notes`, `severity` (`low`/`medium`/`high`/`critical`), `trade`, `status` (`open`/`in_progress`/`closed`/`disputed`, default `open`), `created_by`, timestamps.
- `snag_comments`: `id`, `snag_id`, `org_id`, `user_id`, `body`, `created_at`.
- Security-definer helper `is_org_member(_org_id, _user_id)` and `is_org_admin(_org_id, _user_id)`.
- GRANTs to `authenticated` + `service_role` on every new public table.
- RLS on every table:
  - `orgs`: members can SELECT; only creator (bootstrap) can INSERT.
  - `org_members`: members see their own org's rows; only org admins can INSERT/DELETE (invite/remove subs).
  - `snag_projects` / `snags` / `snag_comments`: members of `org_id` can SELECT; admins + authors can INSERT; admins + creators can UPDATE/DELETE their own; comments visible to org members.
- Storage bucket `snag-photos` (private) with RLS: read/write restricted to members whose `org_id` matches the folder prefix (`{org_id}/…`).

## 2. Seed 5 admin accounts + invite flow

You asked for 5 separate admin accounts, each able to invite 2 subcontractors — no auto-created sub users.

- Migration seeds **5 orgs**: `Test Org 1…5` (rows only, no users tied yet).
- Add a one-off **admin-claim server function**: authenticated user chooses one of the 5 orgs (by slug/invite code) and becomes its admin — only if the org has no admin yet. Idempotent, first-come-first-served. You'll sign up 5 times (or use existing accounts) and claim each org.
- **Invite subcontractor** server function (admin-only): admin enters an email → creates a signed invite token → link `/invite-org/$token` → on accept, user is added to `org_members` as `subcontractor`. Cap enforced at 2 subs per org.
- Simple `/org` admin page listing members + "Invite Subcontractor" button.

## 3. Snag Master UI

New routes under `src/routes/_authenticated/`:

- `snags.index.tsx` → `/snags`: dark editorial header, filter bar (status chips: All / Open / In Progress / Closed / Disputed), big "New Snag" camera/upload CTA, glass-card grid (thumbnail, defect title, severity badge, trade, status, date). Filtered by current user's `org_id`.
- `snags.new.tsx` → `/snags/new`: upload photo → uploads to `snag-photos/{org_id}/{uuid}.jpg` via signed URL → calls server function `analyzeSnag({ photoPath })` → shows loading "The Foreman is inspecting…" → renders full AI report with **Save** and **Discard**. Save inserts into `snags`.
- `snags.$snagId.tsx` → `/snags/:snagId`: full report layout — hero photo with click-to-zoom lightbox, defect title/description/cause, two rectification option cards (A & B), gold "Tradesman's Hack" callout, regulatory citations list, H&S notes, status dropdown (admin/creator only), Site Manager's Log comment thread (post + list).
- Top nav: add "Snag Master" button (Camera icon from lucide) next to Projects, linking to `/snags`.

Design: reuse existing Quiet Luxury tokens — dark headers, glass card variant, orange accent for CTAs and the gold hack callout. No new colors added; all values go through existing semantic tokens in `src/styles.css`.

## 4. AI endpoint — in-project, not Vercel

Server function `analyzeSnag` in `src/lib/snags.functions.ts`:

- Middleware: `requireSupabaseAuth`.
- Input: `{ photoPath: string }` (path inside `snag-photos`).
- Handler:
  1. Verify caller is a member of the org that owns the path.
  2. Create a signed URL for the photo (1h).
  3. Call Lovable AI Gateway via `@ai-sdk/openai-compatible` with `openai/gpt-4o` (Vision) using `generateText` + `Output.object({ schema })` to force a structured report: `{ defectTitle, description, cause, rectificationOptionA, rectificationOptionB, tradesmanHack, regulatoryCitations[], hsNotes, severity, trade }`.
  4. Return the parsed object. Client stores it in local state until Save.
- Uses `LOVABLE_API_KEY` (already provisioned).
- Handles 429/402 by surfacing a clear message in the UI.

## 5. Verification

- After migration approval: check tables/policies via read query.
- Manually walk through: sign up → claim org → upload photo → AI report renders → save → detail page → comment → status change → invite sub → sub signs in and can view but not edit.

---

## Technical details

- Files created: `src/routes/_authenticated/snags.index.tsx`, `snags.new.tsx`, `snags.$snagId.tsx`, `org.tsx`, `invite-org.$token.tsx`; `src/lib/snags.functions.ts`, `src/lib/orgs.functions.ts`; small `SnagCard`, `SeverityBadge`, `StatusPill`, `PhotoLightbox` components under `src/components/snags/`.
- Nav edit: wherever the top nav is rendered (root or shared header) — add Camera icon link.
- No changes to existing routes, RLS on legacy tables, or existing role/subscription logic.
- Migration is one file; approval required before code lands.

## What I need from you

1. Confirm the plan or tell me what to change.
2. If you have specific admin emails already in mind, list them — otherwise you'll self-claim orgs after signup.

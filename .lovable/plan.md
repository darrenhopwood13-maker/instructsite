# Scope projects to orgs + global user context chip

Two connected changes: make every project belong to an organisation (so org admins actually own their projects), and add a persistent header chip that shows the signed-in user's name, role, org, current project and a live date on every page.

---

## 1. Projects are scoped to an organisation

The `projects` table already has a nullable `org_id` column referencing `orgs`. We'll make it required and enforce it end-to-end.

### Database migration

- Backfill any existing `projects.org_id IS NULL` rows by picking the creator's first org membership. Rows with no resolvable org (founder-created without an org) get assigned to a dedicated "Founder Sandbox" org, auto-created if missing.
- `ALTER TABLE public.projects ALTER COLUMN org_id SET NOT NULL`.
- Add index on `projects(org_id)`.
- Replace `projects` RLS SELECT/INSERT/UPDATE/DELETE policies so access is granted when the caller is:
  - a member of `projects.org_id` (via `org_members`), OR
  - a project member (existing `project_members` path), OR
  - the founder / `master_admin`.
- INSERT policy also requires the caller to be an admin (`role in ('org_admin','admin')`) of the target `org_id`, or a `master_admin`.
- Cascade delete stays as-is (`ON DELETE CASCADE` from orgs).

### Server functions (`src/lib/projects.functions.ts`)

- `createProject`: add required `orgId: z.string().uuid()` input. Authorisation becomes: `master_admin` OR org admin (`org_admin` role in `org_members` for that org). Insert with `org_id: data.orgId`. Also insert an `org_members` row for the creator if missing.
- `listMyProjects`: unchanged shape but include `org_id` and org name in the select; RLS handles scoping.
- `getProject`: include `org_id` + org name.
- Add `listMyOrgsForProjectCreation()` returning `{ id, name, role }[]` for the current user's org memberships where they can create projects (org_admin or founder-of-all).

### UI

- `src/routes/projects.new.tsx`: add an **Organisation** select (required) at the top of the form. Founder sees all orgs; org admins see only their orgs; PMs/subs cannot access this route.
- `src/routes/projects.index.tsx`: group or badge each project card by its organisation name.
- `/org/$orgId` detail page: list the org's projects with a "New project in this org" shortcut that pre-selects the org.

---

## 2. Global user context chip in the top bar

A single component rendered inside `src/routes/__root.tsx` header, visible on every route when signed in.

### Data

New server fn `getSessionContext()` (in `src/lib/session.functions.ts`, `requireSupabaseAuth`) returning:

```
{ userId, fullName, email, roles: string[], org: { id, name } | null, isFounder }
```

Sources: `profiles.full_name` (fallback to email local-part), `user_roles`, `org_members` + `orgs`, founder check via `OWNER_EMAIL`.

Current project is derived client-side from the active route params (`projects.$projectId`, `dabs.$projectId`, `programme.$projectId`, `projects_.$projectId.bible`, `subcontractor-pack.$projectId.*`, `site-manager.$projectId`, `billing.$projectId`, `subcontractor.$projectId`). A tiny `useCurrentProjectId()` hook reads `useMatches()` for a `projectId` param; when present, a lightweight query fetches `{ id, name }` via existing `getProject`.

### Component: `src/components/layout/UserContextChip.tsx`

- Left cluster: initials avatar + full name + a caret; on click opens a dropdown with:
  - Roles (badges: Founder / Org Admin / PM / Subcontractor / etc.)
  - Organisation name (link to `/org/$orgId` if org admin, else read-only)
  - Current project name (link to project home) or "No project selected"
  - Divider → Account / Sign out
- Right cluster: live date+time (updates every 30s via `useEffect` + `setInterval`), formatted as `Thu 23 Jul 2026 · 14:32` using `Intl.DateTimeFormat("en-GB")`.
- Mobile (<640px): collapses to avatar + short date; full details inside the dropdown.
- Styled with existing glass tokens (navy/orange) to match the rest of the shell; no new colour tokens.

### Wiring

- `src/routes/__root.tsx`: replace the current name/email display in the signed-in nav cluster with `<UserContextChip />`. Keep the existing Manual / Open instructSite / Sign out buttons. Signed-out state is unchanged.
- Data fetched via TanStack Query with a 60s `staleTime`; invalidated on `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED` (already wired in `__root`).
- SSR-safe: date renders after hydration to avoid mismatch (`useHydrated`).

---

## Technical details

- Founder identity comes from `src/lib/owner.ts` (`OWNER_EMAIL`). No new env vars.
- Migration order per project rules: `ALTER` after backfill; new policies added with matching GRANT already in place for `projects`.
- Types regenerate after migration approval, so server-fn edits land in a follow-up edit batch.
- No changes to `dabs`, `programme`, `snags` flows — they continue to key off `project_id`; RLS on `projects` is what enforces org isolation transitively (child tables already filter by `project_id`).

## Out of scope

- Moving existing projects between orgs (can add later as an org-admin action).
- Per-org billing / subscription split.
- Changing subcontractor or DABS RLS — those already inherit via project membership.

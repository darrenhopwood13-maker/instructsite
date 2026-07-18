## Goal

1. Make `/subcontractor/$projectId` (the Subcontractor Cockpit) behave properly on phone-sized screens — no clipped drawing names, no horizontal overflow, no cramped header.
2. Ensure subcontractors and subcontractor-side Project Managers cannot reach or link into the Site Manager Command Tower (`/site-manager/$projectId`). That area is for the main contractor's site manager, project admin, and master admin only.

## Scope (files that change)

- `src/routes/subcontractor.$projectId.tsx` — mobile layout tweaks, drawing-name shortening.
- `src/routes/site-manager.$projectId.tsx` — hard role gate at page level.
- `src/routes/dabs.$projectId.tsx` — hide "Site Manager Command Tower" link for anyone who is not main-contractor staff.
- `src/routes/projects.$projectId.tsx` — hide the "Site Manager" header link on the project page for non-main-contractor users (defence-in-depth; the page itself already gates by role).
- `src/routes/dashboard.tsx` — the "Enter Command Tower" project-card CTA already lives behind an admin gate (master_admin / project_admin), so no change there.

Nothing changes in server functions or the database — the site-manager route already reads project data through RLS; we're just adding a clean client-side role check and access screen so the wrong users don't land there in the first place.

## Part A — Subcontractor Cockpit responsive fixes

Current problems observed in the file:

- Header meta row concatenates project number, company, email inline; on ≤360 px widths the row wraps awkwardly and truncates mid-word.
- The two-column grid (Live Date / Weather) is fixed `grid-cols-2` with a vertical divider — tight on small phones and pushes text under the divider.
- Active Drawing button shows `{drawing_no} — {title}` on one line with `truncate`; long titles cut mid-word with no rev info visible.
- Drawing sheet list items show `drawing_no · Rev X` on one line and title on another, both `truncate` — but the whole row uses `p-3` + 40 px icon, so on small phones the title becomes ~15 chars.

Fixes:

1. Convert the header meta line to a two-line stack on mobile: line 1 = `#projectNumber` (mono) + company name (`truncate`, `min-w-0`); line 2 = email (`truncate`, muted). Promote to inline row at `sm:`.
2. Add `min-w-0` to every flex text container in the header, active-shift card, and drawing selector button (already partially applied — audit and complete). Icons get `shrink-0`.
3. Live Date / Weather grid: keep `grid-cols-2` but drop `divide-x` on mobile (use a bottom border between rows when it stacks) and reduce label tracking so text fits. Alternatively promote to two stacked cards at `<sm` and side-by-side at `sm:`.
4. Drawing-name shortening — apply everywhere the drawing appears (Active Drawing button line 431-435, sheet list line 734-740, and the smaller "Full DABS View" area if it reappears):
   - Introduce a small `formatDrawingLabel(d, { maxTitleChars })` helper local to the file that returns `{ code, title }` where `code = drawing_no || "DWG"` and `title` is trimmed to `maxTitleChars` with an ellipsis (word-boundary aware, e.g. 28 chars on mobile, 48 on `sm:`).
   - Render `code` as its own line (mono, bold) and `title` on a second line with `truncate` — never concatenated with `—` on mobile. Concatenated single-line form is fine from `sm:` up.
5. Bottom padding: add `pb-[max(env(safe-area-inset-bottom),5rem)]` on the outer scroll container so the Oracle FAB doesn't cover the "Full DABS View" link on iOS.
6. Sanity pass with the responsive-layout rules from house style: every text container in a flex row gets `min-w-0`; every fixed icon/avatar gets `shrink-0`; single-line headings get `truncate`.

No layout/logic beyond that — the page's information architecture stays identical.

## Part B — Lock down the Site Manager Command Tower

Definition of "main-contractor staff" for this app:

- `user_roles.role` in `('master_admin', 'project_admin', 'site_manager')`, OR
- `project_members.role_on_project` = `'project_admin'` for this project (via `is_project_admin`).

Subcontractors and subcontractor-side org PMs are NOT in that set — org PMs are admins of their subcontractor org, not of the main-contractor project.

Changes:

1. **`site-manager.$projectId.tsx` — page-level gate.**
   Fetch `getMyRoles()` alongside the existing `getProject` query. Compute:
   ```ts
   const roles = rolesQ.data?.roles ?? [];
   const isMainContractor =
     roles.includes("master_admin") ||
     roles.includes("project_admin") ||
     roles.includes("site_manager");
   ```
   Before rendering the tower, if `ready && !rolesQ.isLoading && !isMainContractor`, render `<AccessDeniedScreen message="The Site Manager Command Tower is restricted to the main contractor's site management team." />`. This runs before any of the tower queries fire.

2. **`dabs.$projectId.tsx` — hide the entry button.**
   Reuse `getMyRoles` (already imported elsewhere in the app; add the query here). Wrap the `<Link to="/site-manager/$projectId">` block (lines 274-282) in `{isMainContractor && ( … )}`. Subs still see everything else on DABS.

3. **`projects.$projectId.tsx` — hide the "Site Manager" header pill.**
   Same `isMainContractor` check; wrap the Link at lines 163-170. Project page itself remains accessible to members.

4. **Dashboard.** No change — the "Enter Command Tower" card CTA is only rendered inside the `/dashboard` page, which already refuses to render for anyone lacking `master_admin` / `project_admin`.

## Technical notes

- No DB migration. Server-side RLS on `projects`/`live_site_activity` already tolerates unauthorised access with an error, but that produces a broken tower UI rather than a clean denial — the new client gate gives the right UX and stops needless queries.
- `getMyRoles` returns `{ roles: string[] }` and is safe to call from any authenticated route via `useServerFn` + `useQuery`, matching the pattern used in `src/routes/dashboard.tsx`.
- All responsive changes stay within Tailwind utility classes already used in the project (`glass-panel`, `min-w-0`, `shrink-0`, `truncate`, `sm:` breakpoints). No new components.

## Out of scope

- No changes to the subcontractor pack (`/subcontractor-pack/...`) — the user's message names the "cockpit" specifically.
- No changes to server functions or RLS policies.
- No visual redesign; only responsive polish and access gating.

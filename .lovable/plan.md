# Add Organisation Admin role

Today, org invites accept only two roles: `admin` (currently labelled "Project Manager") and `subcontractor`. There's no seat with full org-wide rights (create/delete projects, invite subcontractors, manage org). Founder is the only one who can currently do that.

We'll introduce a new role `org_admin` — a separate standard seat, invited from the same "New Organisation" and "Edit Organisation" screens, with full project + subcontractor management rights inside their org.

## Roles after change

- `org_admin` (new) — 1 standard seat. Full rights inside the org: create/edit/delete projects, invite subcontractors, manage members/invites, edit org details. Cannot touch other orgs.
- `admin` (Project Manager) — 1 standard seat. Existing behaviour: PM on projects they're assigned to. No org-level admin rights.
- `subcontractor` — 2 standard seats. Unchanged.

Total standard seats per org becomes 1 + 1 + 2 = 4.

## Database (single migration)

1. Widen check constraints:
   - `org_members_role_check` → `('org_admin','admin','subcontractor')`
   - `org_invites_role_check` → same
2. Update `enforce_org_member_caps()` trigger to also cap `org_admin` at 1 standard seat, and include it in the "all standard seats claimed" precondition for non-standard members (now requires 1 org_admin + 1 admin + 2 subs).
3. Update `org_admin_count(_org_id)` if used anywhere for gating (verify; currently only counts `role='admin'` — leave for PM count; add helper `is_org_admin_role(_org_id,_user_id)` returning true when user is `org_admin`, so RLS policies can grant full write access).
4. Extend RLS policies on `projects`, `subcontractor_invites`, `subcontractors`, `project_members`, `org_invites`, `org_members` so `org_admin` of the owning org has the same rights as founder within that org (create/update/delete). Founder path stays intact.

## Server functions (`src/lib/orgs.functions.ts`)

- `inviteRowSchema` / `inviteMemberSchema`: accept `"org_admin" | "admin" | "subcontractor"`.
- `createOrg`: seat validation becomes `orgAdminCount ≤ 1`, `pmCount ≤ 1`, `subCount ≤ 2`.
- `listOrgInvites` / other permission checks: treat `org_admin` as equivalent to founder for that org.
- `getMyOrg` return type: `role: "org_admin" | "admin" | "subcontractor"`.
- Add gating helper `isOrgAdmin(context, orgId)` used by project/subcontractor mutation server fns to allow org_admins alongside founder.

## Related server fns that must accept org_admin

Audit and update authorization in: `src/lib/projects.functions.ts`, `src/lib/subcontractors.functions.ts` (assertProjectAdmin path), `src/lib/orgs.functions.ts` invite/remove member fns, and any `is_project_admin`/founder-only gate that should also pass for that org's `org_admin`.

## UI

- `src/routes/org.new.tsx`: add an "Organisation Admin Email" field (with `Shield` icon) above the PM field. Include it in the `invites` array with `role: "org_admin"`. Update the helper copy: "Every organisation has 4 standard seats: 1 Org Admin + 1 Project Manager + 2 Subcontractors."
- `src/routes/org.$orgId.edit.tsx`: same new field + display org_admin invite/member rows with a distinct label + badge.
- `src/routes/org.$orgId.index.tsx` and members list: render "Org Admin" label for the new role.
- `src/lib/ensure-oracle-session.ts` `routeForRoles`: no change needed (all roles already route to `/projects`), but ensure org_admin can reach `/org/$orgId/edit` and `/projects/new` — gated by server fns above.

## Out of scope

- No changes to `user_roles` app_role enum (that's project-level roles: master_admin/site_manager/etc.). Org role lives only in `org_members.role`.
- No email template changes; existing invite email flow reused.

## Verification

- Migration applies cleanly; trigger accepts 1 org_admin + 1 admin + 2 subs and rejects a second org_admin.
- Founder creates an org with all 4 invite emails; each invitee sets a password and lands in the org with the right role.
- Signed in as org_admin: can create a project, invite a subcontractor, edit org details. Signed in as PM (`admin`): cannot delete projects or edit org details.
- Signed in as org_admin of Org A: cannot see/modify Org B.

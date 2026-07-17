## Add Member Invites to Organisations

### New Org form
Add a repeatable **Invite Members** section (up to 3 rows visible on create):
- 1 fixed slot: **Project Manager** (email)
- 2 fixed slots: **Subcontractor** (email)
Each row: email input + role label (fixed for the 3 standard seats). Emails optional at creation time — org can be created empty and invites sent later.

### Edit Org page
- Show current member list with role, status (invited/joined), invited date.
- Show **seat usage**: `X / 3 standard seats used`.
- **Add-member form is disabled** until all 3 standard seats are filled (1 PM + 2 Subs joined *or* pending). Once used, extra members can be added with role selector (Project Manager / Subcontractor) — these are "additional" seats beyond the standard 3.
- Only visible to the founder.

### Backend
1. **Migration**
   - New table `org_invites`: `id, org_id, email (citext), role ('project_manager'|'subcontractor'), token (uuid), status ('pending'|'accepted'|'revoked'), invited_by, created_at, accepted_at, accepted_by`.
   - Rename `org_members.role` enum semantics: `admin` → keep for backwards compat, but treat `project_manager` as the new PM label. Add `project_manager` as accepted role value; keep the 1 PM + 2 sub cap trigger, extend to allow "additional" flagged rows past the cap.
   - Add `is_standard boolean default true` on `org_members` and `org_invites`. Trigger enforces: max 1 PM standard, max 2 sub standard. Non-standard (additional) rows unlimited but only insertable once all 3 standard seats exist for that org.
   - GRANTs + RLS: founder full access; org admins read own org's invites.

2. **Server functions** (`src/lib/orgs.functions.ts`)
   - `inviteOrgMembers({ orgId, invites: [{email, role}] })` — founder only. Validates seat rules, inserts `org_invites` rows, generates tokens.
   - `listOrgInvites({ orgId })` — founder + org admins.
   - `revokeOrgInvite({ inviteId })` — founder.
   - `acceptOrgInvite({ token })` — auth'd user; links user to org with matching role.
   - `createOrg` — extended to accept optional `invites[]` and create them in the same transaction.

3. **Invite delivery**
   - Generate accept link `/join-org/invite/$token`.
   - Display generated links in the UI after creation (copy-to-clipboard) — email sending out of scope for this change unless Lovable Emails already set up (not currently). Founder can share links manually.

### UI
- `src/routes/org.new.tsx`: add invite rows section before submit.
- `src/routes/org.$orgId_.edit.tsx`: add "Members & Invites" panel + gated "Add additional member" form.
- `src/routes/org.$orgId.index.tsx`: show invite list & statuses.
- New `src/routes/join-org.invite.$token.tsx`: token-based accept flow (signed-in users only).

### Out of scope
- Actual email delivery (invite links shown in UI/copied manually). Can be added later with Lovable Emails.

Confirm and I'll build it.

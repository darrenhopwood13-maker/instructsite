## Fix: ambiguous `org_id` in `accept_org_invite`

**Root cause (confirmed from db function list):** The `accept_org_invite(_token uuid)` RPC declares `RETURNS TABLE(org_id uuid, role text)`. Its final `RETURN QUERY SELECT v_inv.org_id, v_inv.role;` is fine, but the earlier `INSERT INTO public.org_members(org_id, user_id, role, is_standard) VALUES (v_inv.org_id, ...)` — and the `UPDATE public.org_invites ... WHERE id = v_inv.id` context — makes Postgres see `org_id` as ambiguous between the output column name and the table column. This throws at accept time, right after the PM sets a password and lands on `/join-org/invite/$token`.

### Change

Ship a migration that replaces the function with a version that:
1. Renames the OUT columns to avoid the name clash: `RETURNS TABLE(out_org_id uuid, out_role text)`.
2. Keeps all internal references qualified via `v_inv.*`.
3. Returns `SELECT v_inv.org_id, v_inv.role`.

Then update the one caller (`acceptOrgInvite` in `src/lib/orgs.functions.ts`) to read `out_org_id` / `out_role` from the RPC result (it currently reads `row.org_id` / `row.role`).

### Technical details

- Migration: `CREATE OR REPLACE FUNCTION public.accept_org_invite(_token uuid) RETURNS TABLE(out_org_id uuid, out_role text) ...` with the same body, `SECURITY DEFINER`, `search_path=public`.
- Code: in `acceptOrgInvite`, map `row.out_org_id → orgId`, `row.out_role → role`. No UI changes needed; the invite accept page already navigates on success.

### Not changing

- No changes to `org_invites` / `org_members` schema, RLS, or the reset-password → invite redirect flow.
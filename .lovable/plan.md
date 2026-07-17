## Add Subcontractor Compliance Schema

Create a migration adding 5 new tables for subcontractor compliance tracking, with proper multi-tenant scoping, RLS, and GRANTs (the pasted SQL is missing these — required on this project).

### Tables

1. `**subcontractors**` — `company_name`, `manager_name`, plus `project_id` (FK → `projects`) so records are scoped per project like the rest of the app.
2. `**workers**` — `subcontractor_id`, `name`, `role`, `competency_card_url`.
3. `**registers**` — `subcontractor_id`, `type` (PUWER/LOLER/HAVS/Plant), `asset_name`, `inspection_date`, `certificate_url`.
4. `**toolbox_talks**` — `subcontractor_id`, `topic`, `attendance_list` (jsonb), `date`.
5. `**look_aheads**` — `subcontractor_id`, `work_plan`, `is_high_risk`, `permit_required`, `date`.

Each table gets `id`, `created_at`, `updated_at` + update trigger.

### Security (required, not in pasted SQL)

- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;` on every table.
- Enable RLS on all 5.
- Policies use existing `is_project_member` / `is_project_admin` helpers, resolving `project_id` via the parent `subcontractors` row for the child tables. Members can read; admins can write. Founder (`darrenhopwood13@gmail.com`) bypass follows the existing pattern.

### Storage

Add a private `compliance-docs` bucket for competency cards + inspection certificates (referenced by `competency_card_url` / `certificate_url`).

### Out of scope for this plan

No UI/routes/server functions yet — this plan is schema only. Confirm and I'll follow up with a UI plan (Subcontractors hub page, workers list, register uploads, toolbox talks, look-aheads).

### Questions before I write the migration

1. Should `subcontractors` be scoped by `project_id` (my assumption, matches your app) or by `org_id`?
2. Should any of these tables tie back into the existing `subcontractor_invites` / `project_members` (i.e. link a `worker` to an auth user), or are they purely record-keeping for now?
  answers  1. use your assumption. 2 record keeping for now 
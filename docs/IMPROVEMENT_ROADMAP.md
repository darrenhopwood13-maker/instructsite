# Improvement roadmap

Priorities are P0 (must ship before real users), P1 (fill core gaps), P2 (polish), P3 (nice-to-have). Items marked **DONE** shipped in the P0 + progress-math sprint.

## P0 — Security & correctness

- [x] **Kill dev master-admin auto-promotion.** `getMyRoles` no longer inserts a role on demand. Only the very first user in the system (when no `master_admin` exists yet) is auto-promoted. Every subsequent user gets no role. **DONE**
- [x] **Server-side role gate on QS approval.** `setDiaryQsStatus` now checks `has_role(userId, master_admin | project_admin | site_manager)` and hard-fails with a `Forbidden` error otherwise. **DONE**
- [x] **Kill project self-enrolment.** `getProject` no longer auto-inserts non-members. Non-members get an "Access Restricted" screen. **DONE**
- [x] **Progress math is cumulative.** DB trigger `trg_sync_zone_ifc` re-tallies approved completion per zone on every insert/update and flips `ifc_synced=true` once the sum reaches 100. `listZoneRuntimeState` returns `progress_pct` per zone. **DONE**

## P1 — Fill core gaps

- [x] **Project-scope Oracle.** `runOracleCommand` now requires `projectId`; both it and `askProjectOracle` call `assertProjectMember` (server-side `is_project_member`) before retrieval, and `retrieveSnippets` builds an allowlist of `site_document_id`s from the project's drawings/logistics plans/RAMS/bible reports and only queries `.in("id", …)` on that list. `document_contents` SELECT policy widened from uploader-only to project-member (`can_view_site_document`). **DONE**
- [x] **Wire QS photo viewer.** Signed-URL thumbnail grid with click-to-fullscreen lives in `QsEvidenceModal` inside `QsVerificationQueue`. **DONE**
- [x] **Verify FK cascade** on project delete. Every FK referencing `public.projects` is `ON DELETE CASCADE` or `SET NULL` (verified live: zero gaps). A `BEFORE DELETE` trigger on `projects` also removes the owning `site_documents` rows behind drawings/logistics/RAMS/bible reports. Regression guard: `project_delete_cascade_gaps()` + `src/lib/fk-cascade.test.ts`. **DONE**
- [ ] **Activities + permits.** Either wire the `activities` table + `permits` UI + `auto_flag_permit_required` trigger into DABS (paper-briefing description, permit issuance, high-risk auto-flag) or drop them from the schema. Recommendation: wire them — permit control is table-stakes for construction.
- [x] **Proper login flow.** Real Supabase email/password sign-up / sign-in / reset / sign-out at `/auth` + `/reset-password`; roles live in `user_roles` and are enforced by RLS and `SECURITY DEFINER` helpers (`has_role`, `is_project_member`, `is_project_admin`), not client checks. Anonymous/self-enrolment paths removed: `dev_claim_master_admin` RPC dropped, `src/lib/dev-admin.functions.ts` deleted, the "Dev Override" button removed from `AccessDeniedScreen`, and upload-time auto-enrolment in `tier1-uploads.functions.ts` replaced with a hard membership check. Google OAuth still outstanding. **DONE (except Google OAuth)**

## P2 — Workflow polish

- [ ] **DABS as an actual pre-shift briefing.** Add planned-work description, expected outputs, and safety notes to the pin-drop modal — store on a new column or in the `activities` table.
- [ ] **Site manager force-checkout.** If a subcontractor forgets to close out, the SM can force-close a pin AND record a diary on their behalf.
- [ ] **Auto-map IFC by name.** Client-side heuristic in `BimMappingEditor` that pre-fills the zone dropdown for each element using its IFC Name + containing storey. Reviewed and saved by the admin.
- [ ] **Show project name on Oracle answers** once Oracle is project-scoped.

## P3 — Nice-to-have

- [ ] Master-admin cross-project portfolio view (all projects + roll-up progress).
- [ ] Real map for zones (or rename Zone Map → Zone Board and accept the card grid).
- [ ] Use `is_project_admin` / `can_view_site_document` DB functions in RLS policies (they exist but are unused today) or delete them.
- [ ] Notifications: overtime, permit expiry, diary rejected.

---

## What each item touches (quick lookup)

| Item | Files |
|---|---|
| Oracle scoping | `src/lib/oracle.functions.ts`, `src/pages/Oracle.tsx`, migration for `document_contents.project_id` |
| QS photo viewer | `src/components/project/QsVerificationQueue.tsx`, add signed-URL server fn |
| FK cascade | one migration touching all child FKs |
| Activities/permits | `src/lib/activities.functions.ts`, `src/routes/dabs.$projectId.tsx`, new permit UI |
| Login flow | `src/routes/_authenticated/route.tsx`, new `/auth` route, `ensureOracleSession` removal |
| IFC auto-map | `src/components/project/BimMappingEditor.tsx` |

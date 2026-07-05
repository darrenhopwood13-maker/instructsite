# Improvement roadmap

Priorities are P0 (must ship before real users), P1 (fill core gaps), P2 (polish), P3 (nice-to-have). Items marked **DONE** shipped in the P0 + progress-math sprint.

## P0 — Security & correctness

- [x] **Kill dev master-admin auto-promotion.** `getMyRoles` no longer inserts a role on demand. Only the very first user in the system (when no `master_admin` exists yet) is auto-promoted. Every subsequent user gets no role. **DONE**
- [x] **Server-side role gate on QS approval.** `setDiaryQsStatus` now checks `has_role(userId, master_admin | project_admin | site_manager)` and hard-fails with a `Forbidden` error otherwise. **DONE**
- [x] **Kill project self-enrolment.** `getProject` no longer auto-inserts non-members. Non-members get an "Access Restricted" screen. **DONE**
- [x] **Progress math is cumulative.** DB trigger `trg_sync_zone_ifc` re-tallies approved completion per zone on every insert/update and flips `ifc_synced=true` once the sum reaches 100. `listZoneRuntimeState` returns `progress_pct` per zone. **DONE**

## P1 — Fill core gaps

- [ ] **Project-scope Oracle.** Add `project_id` to the document lookup (join via `site_documents`). Read the `sessionStorage` "oracle:context" that the UI already writes and pass `projectId` to `runOracleCommand`.
- [ ] **Wire QS photo viewer.** Signed URLs for each `photo_urls` entry, thumbnail grid inside the QS Queue card, click-to-fullscreen. Right now QS only sees a count.
- [ ] **Verify FK cascade** on project delete. Migration to ensure `ON DELETE CASCADE` on every child FK (`live_site_activity`, `daily_site_diaries`, `project_drawings`, `work_zones`, `project_ifc_models`, etc.) so `deleteProject` succeeds.
- [ ] **Activities + permits.** Either wire the `activities` table + `permits` UI + `auto_flag_permit_required` trigger into DABS (paper-briefing description, permit issuance, high-risk auto-flag) or drop them from the schema. Recommendation: wire them — permit control is table-stakes for construction.
- [ ] **Proper login flow.** Replace anonymous sessions with email/password + Google OAuth. Add `_authenticated` layout gate. Invitations flow so masters can add project members by email.

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

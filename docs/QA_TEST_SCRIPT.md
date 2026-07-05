# Full QA Testing Procedure

Run top-to-bottom in order. Tick each box as you go. If anything fails, screenshot the state, note the test number, and stop before fixing so the failing state can be inspected.

**Setup you need in hand:**
- 2 email addresses you can sign in with (User A = admin, User B = subcontractor).
- 1 multi-page architectural PDF (5+ pages, at least one with visible zone labels like "L01", "Core", "Zone A").
- 1 small `.ifc` file (any test model, <20 MB).
- 1 JPG photo on your phone (for the diary evidence upload).
- Access to run SQL against the database (View Backend).

---

## Section 1 — Access & roles

### T1.1 Bootstrap first master admin
- [ ] Fresh DB. User A signs up.
- [ ] `SELECT user_id, role FROM user_roles;` → **only User A, role=`master_admin`**.
- [ ] User A visits `/projects` → **"New Project"** button visible.

### T1.2 Second user gets nothing
- [ ] User B signs up in a separate browser.
- [ ] User B visits `/projects` → **no "New Project" button**.
- [ ] User B navigates directly to `/projects/new` → form disabled / "Access denied".
- [ ] `SELECT * FROM user_roles WHERE user_id='<UserB>';` → **0 rows**.

### T1.3 Preview password gate (published build only — skip in Lovable preview)
- [ ] On the `.lovable.app` published URL, visit any route while logged out → **redirected to `/unlock`**.
- [ ] Enter wrong password → error, still on `/unlock`.
- [ ] Enter correct `SITE_PASSWORD` → routed to originally requested page.
- [ ] Visit an invite link `/invite/<token>` → **second `/unlock` prompt with scope=invite**. Enter password → invite loads.

---

## Section 2 — Project creation

### T2.1 Create a project (User A)
- [ ] `/projects` → **New Project** → name "QA Test 1" + site address → submit.
- [ ] Redirected to `/projects/<id>`.
- [ ] `SELECT id, name, master_admin_id, project_admin_id FROM projects WHERE name='QA Test 1';` → 1 row, both admin IDs = User A.
- [ ] `SELECT * FROM project_members WHERE project_id='<id>';` → 1 row, User A as `project_admin`.

### T2.2 Non-admin cannot see project
- [ ] As User B, visit `/projects/<id>` directly → **"Access Restricted"** screen with return button.
- [ ] `SELECT * FROM project_members WHERE user_id='<UserB>';` → still 0 rows (no self-enrolment).

---

## Section 3 — Drawing pack ingestion (the AI pipeline)

### T3.1 Upload a multi-page drawing pack
- [ ] On `/projects/<id>`, drop the 5-page PDF into the Drawings DropZone.
- [ ] Within ~10s: 5 pending rows appear.
- [ ] Within ~60s: `SELECT drawing_no, title, extraction_status FROM project_drawings WHERE project_id='<id>';` → 5 rows, all `extraction_status='complete'`, `drawing_no` and `title` populated.

### T3.2 Zones auto-created from drawings
- [ ] `SELECT name, level, source FROM work_zones WHERE project_id='<id>' AND source='drawing';` → **at least 1 row** (assuming the PDF has zone labels).
- [ ] Zone Map card grid on the project page shows those zones.

### T3.3 Drawing viewer renders
- [ ] Click a drawing card → viewer opens.
- [ ] PDF **renders as a canvas image** (not blank, not "cannot preview").
- [ ] Pan (drag) works.
- [ ] Zoom (wheel / pinch) works.

### T3.4 Raw pack cleaned up
- [ ] In storage bucket `project-bible/{userId}/{projectId}/`, `raw_incoming_packs/` is empty or gone; `drawing/pages/` contains per-page PDFs.

---

## Section 4 — Manual zones + Master Admin HUD

### T4.1 Create a manual zone
- [ ] HUD → **Create Work Zone** → name "TEST-MANUAL", level "L99" → save.
- [ ] `SELECT source FROM work_zones WHERE name='TEST-MANUAL';` → `manual`.
- [ ] Card appears in Zone Map.

### T4.2 Toggle zone open/closed
- [ ] Toggle "TEST-MANUAL" to `closed` → card visibly greys.
- [ ] Try to drop a DABS pin against it later (T6) → rejected.
- [ ] Re-open.

---

## Section 5 — Subcontractor registration & invite

### T5.1 Register a subcontractor company
- [ ] Trade Directory panel → **Full Registry** link → `/subcontractors/new`.
- [ ] Fill: company name "WestShore Steel", VAT + reg no, HQ address; PM name/mobile/email; Supervisor name/mobile/email; trade packages "Steelwork".
- [ ] Click **Save Partner & Generate Access Tokens**.
- [ ] Success pane shows: **copyable invite link** + **QR code SVG**.
- [ ] `SELECT company_name, trade_packages, expires_at FROM subcontractor_invites ORDER BY created_at DESC LIMIT 1;` → row exists, `expires_at` in the future.

### T5.2 Subcontractor accepts invite
- [ ] Open the invite link `/invite/<token>` in User B's browser.
- [ ] User B is prompted to sign in / already signed in → invite auto-accepts.
- [ ] `SELECT role_on_project FROM project_members WHERE user_id='<UserB>' AND project_id='<id>';` → `subcontractor`.
- [ ] `SELECT role FROM user_roles WHERE user_id='<UserB>';` → includes `subcontractor`.
- [ ] `SELECT accepted_by, accepted_at FROM subcontractor_invites WHERE token_hash=...;` → populated.
- [ ] User B is redirected to `/dabs/<projectId>`.

### T5.3 Expired / revoked invites reject
- [ ] SQL-set an invite's `expires_at` to yesterday → visiting its link shows **"Invite expired"**.
- [ ] SQL-set `revoked_at` to now → **"Invite revoked"**.

---

## Section 6 — DABS pin drop

### T6.1 Drop a pin
- [ ] As User B on `/dabs/<projectId>`, pick zone "L01" + trade "Steelwork".
- [ ] Tap the drawing at roughly the middle.
- [ ] Modal: 4 operatives, start=now, finish=**now + 2 minutes** (so overtime fires soon), notes "test pin".
- [ ] Submit.
- [ ] `SELECT status, x_pct, y_pct, operative_count FROM live_site_activity WHERE subcontractor_id='<UserB>';` → 1 row, `active`, coordinates 0–1.
- [ ] Site manager view (User A, other tab) shows the pin within 8s.
- [ ] 3D BIM viewer (if mapped) shows the zone **pulsing orange**.

### T6.2 High-risk auto-flag
- [ ] Drop another pin with notes "welding overhead".
- [ ] `SELECT high_risk_flags, permit_required, permit_status FROM live_site_activity WHERE notes ILIKE '%welding%';` → `high_risk_flags` contains `hot_works`, `permit_status='required'`.
- [ ] Pin shows red **Permit Required** ribbon on site manager view.

### T6.3 Issue permit (manager)
- [ ] As User A, click the pin → **Issue Permit** → 8 hours.
- [ ] `SELECT status, permit_type, valid_to FROM permits ORDER BY created_at DESC LIMIT 1;` → `active`, correct type.
- [ ] `SELECT permit_status FROM live_site_activity WHERE id='<pinId>';` → `active`.

### T6.4 Subcontractor cannot issue own permit
- [ ] As User B, attempt `issue_pin_permit` via devtools RPC → **403 / "Forbidden"**.

---

## Section 7 — Overtime alerts

### T7.1 Overtime banner
- [ ] Wait for the T6.1 pin's `scheduled_finish` to pass.
- [ ] Site manager view: **red banner** at top + **single toast** fires.
- [ ] `/dashboard` (director) → Global Safety Alert Stream lists the overtime event under this project.

---

## Section 8 — Checkout → auto-diary (the source-of-truth link)

### T8.1 Normal subcontractor checkout
- [ ] As User B on `/dabs/<projectId>`, click **Close Out Today's Shift** on the T6.1 pin.
- [ ] Modal: progress=`completed`, completion=100, notes "done", upload the JPG.
- [ ] Submit.
- [ ] `SELECT project_id, zone_id, drawing_id, trade_package, operative_count, start_time, scheduled_finish, checkout_time, hours_logged, completion_pct, qs_status, ifc_synced, photo_urls, manager_force_closed FROM daily_site_diaries ORDER BY checkout_time DESC LIMIT 1;` — **verify every field**:
  - project_id, zone_id, drawing_id, trade_package, operative_count, start_time, scheduled_finish → copied from the pin (unchanged).
  - checkout_time ≈ now.
  - hours_logged = actual elapsed time in hours (2 dp).
  - completion_pct = 100.
  - qs_status = `pending`.
  - ifc_synced = false.
  - photo_urls = 1 entry.
  - manager_force_closed = false.
- [ ] `SELECT status FROM live_site_activity WHERE id='<pinId>';` → `archived`.
- [ ] Pin removed from live drawing view.
- [ ] New row appears in QS Verification Queue tagged **PENDING**.
- [ ] `diary-photos` bucket contains the uploaded JPG under `{project_id}/{pin_id}/`.

### T8.2 Manager force checkout
- [ ] Drop a new pin as User B, don't close it.
- [ ] As User A, click the pin → **Force Checkout** → 60%, notes "crew left".
- [ ] `SELECT manager_force_closed, force_closed_by, completion_pct, progress_status FROM daily_site_diaries ORDER BY checkout_time DESC LIMIT 1;` → `true`, User A's id, 60, `partial`.
- [ ] Pin archived.

---

## Section 9 — QS role gate

### T9.1 Subcontractor cannot approve
- [ ] As User B, attempt to call `setDiaryQsStatus` (via devtools) on a pending diary.
- [ ] **403** with message "requires site_manager, project_admin, or master_admin".
- [ ] `SELECT qs_status FROM daily_site_diaries WHERE id='<diaryId>';` → still `pending`.

### T9.2 Manager approves
- [ ] As User A, click **Approve** on the T8.1 diary.
- [ ] `qs_status='approved'`.

### T9.3 Manager rejects
- [ ] Create another pending diary. As User A, click **Reject**.
- [ ] `qs_status='rejected'`. It does NOT count towards zone progress.

---

## Section 10 — Cumulative progress → green mesh

Use a **fresh zone** for each scenario so the tallies are clean.

### T10.A Reaches 100 in two hits
- [ ] Zone A: drop pin, checkout at 60%, approve.
- [ ] `SELECT total_pct FROM zone_approved_completion('<projectId>') WHERE zone_id='<zoneA>';` → **60**.
- [ ] 3D viewer: Zone A is **grey with a 60% progress bar** in the legend.
- [ ] Drop another pin on Zone A, checkout at 50%, approve.
- [ ] `total_pct` → **100** (capped).
- [ ] All approved diaries for Zone A: `ifc_synced=true`.
- [ ] Zone A is **solid green**, legend shows 100%.

### T10.B Stays partial forever if never hits 100
- [ ] Zone B: 40% approved, 30% approved.
- [ ] `total_pct` = 70. Zone B grey with 70% bar. Not green.

### T10.C Rejected diaries don't count
- [ ] Zone C: 50% approved, 100% **rejected**.
- [ ] `total_pct` = 50, not 150. Grey with 50%.

---

## Section 11 — IFC / BIM

### T11.1 Upload IFC
- [ ] Upload the `.ifc` file via BimModelUploader.
- [ ] `SELECT filename, active FROM project_ifc_models WHERE project_id='<id>';` → new row with `active=true`; any previous model `active=false`.

### T11.2 Map GlobalIds
- [ ] Open BimMappingEditor → **Scan Model** → assign a GlobalId to Zone A → Save.
- [ ] `SELECT * FROM ifc_element_mappings WHERE zone_id='<zoneA>';` → row exists.
- [ ] Viewer colours the mapped mesh per Zone A's state (green after T10.A).

---

## Section 12 — Oracle

### T12.1 Answer questions
- [ ] `/oracle` → tap **Safety** chip → question "What are the main risks on this project?" → returns a Gemini-authored answer citing site documents.
- [ ] **Known bug:** answer may reference other projects' documents (Oracle isn't project-scoped yet). Log this as expected.

---

## Section 13 — Director's Portfolio

### T13.1 Portfolio grid
- [ ] As User A, `/dashboard`.
- [ ] Every project appears as a card with name, address, active pins count, overtime count, cumulative %.
- [ ] Click **Teleport** on a card → routed to `/site-manager/<projectId>`.

### T13.2 Global safety alert stream
- [ ] Right-side timeline lists live alerts across all projects (overtime, permit required, high-risk flags).
- [ ] Confirm the T7.1 overtime and T6.2 permit request both appear.

---

## Section 14 — Destructive operations

### T14.1 Delete project
- [ ] HUD → **Delete Project** → type project name → confirm.
- [ ] `SELECT * FROM projects WHERE id='<id>';` → 0 rows.
- [ ] `SELECT * FROM project_drawings WHERE project_id='<id>';` → 0 rows (cascade).
- [ ] `SELECT * FROM live_site_activity WHERE project_id='<id>';` → 0 rows.
- [ ] `SELECT * FROM daily_site_diaries WHERE project_id='<id>';` → 0 rows.
- [ ] Storage still holds orphan files (documented limitation — cleanup is on the roadmap).

### T14.2 Non-admin cannot delete
- [ ] Sign in as User B (subcontractor) on a different project they're a member of. They should not see the Delete option at all, and calling the delete RPC returns 403.

---

## Regression checklist (run after ANY change to these areas)

After changes touching `daily_site_diaries`, `live_site_activity`, `work_zones`, or the DABS/Checkout flow:

- [ ] T6.1 (pin drop)
- [ ] T8.1 (auto-diary field copy)
- [ ] T9.1 + T9.2 (role gate + approval)
- [ ] T10.A + T10.B (cumulative progress math)

After changes to the drawing ingestion pipeline:
- [ ] T3.1, T3.2, T3.3

After changes to subcontractor registration / invites:
- [ ] T5.1, T5.2, T5.3

---

## Failure log template

When something breaks, capture:

```
Test number:       T__.__
Route:             /___
Signed in as:      User __ (role: __)
Expected:          ___
Actual:            ___
Console errors:    ___
Network 4xx/5xx:   ___
DB state (query):  ___
Screenshot:        attached
```

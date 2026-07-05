# QA test script

Run top-to-bottom. Tick the box when the expected result matches. If something fails, note the test number and screenshot the state before fixing.

## Pre-flight

- [ ] `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `LOVABLE_API_KEY` are set (server secrets).
- [ ] Visit `/wasm/web-ifc.wasm` — a binary should download (needed for the 3D viewer).
- [ ] Have to hand: one multi-page drawing PDF, one small `.ifc` file, one JPG photo.

---

## Test 1 — Bootstrap admin

- [ ] Fresh database, no users.
- [ ] Sign in as User A → visit `/projects`.
- [ ] **Expected:** User A now has role `master_admin` in `user_roles`. "New Project" button visible.
- [ ] Sign in as User B (second user) → visit `/projects`.
- [ ] **Expected:** User B has **no roles**. "New Project" button hidden. If they try `/projects/new` directly, form disabled with "Access denied".
- **DB check:** `SELECT user_id, role FROM user_roles;` — only User A should have `master_admin`.

## Test 2 — Create a project

- [ ] As User A, `/projects` → **New Project**. Fill name + site address, submit.
- [ ] **Expected:** redirected to `/projects/:id`. One row in `projects`, one row in `project_members` (User A as `project_admin`).

## Test 3 — Drawing pack upload

- [ ] On project page, drop a 5-page PDF into the drawings DropZone.
- [ ] **Expected within ~60s:** 5 rows in `project_drawings` with `extraction_status='complete'`; drawing_no/title extracted for each; N rows in `work_zones` with `source='drawing'`.
- [ ] Click a drawing → viewer opens, PDF renders, pan/zoom works.

## Test 4 — Manual zone

- [ ] Open the Master Admin HUD → create a zone "TEST-ZONE / L01".
- [ ] Toggle it closed, then open again.
- **DB check:** `SELECT name, level, status, source FROM work_zones WHERE project_id='<id>';` — one row with `source='manual'`.

## Test 5 — Project self-enrolment blocked

- [ ] As User B, visit `/projects/<the id User A created>` directly.
- [ ] **Expected:** "Access Restricted" screen with a button back to `/projects`. **No** row inserted into `project_members` for User B.

## Test 6 — DABS pin drop

- [ ] Invite User B into the project as `subcontractor` (manual SQL: `INSERT INTO project_members …`).
- [ ] As User B, go to `/dabs/:projectId`. Pick a zone, type "Test trade", click the drawing.
- [ ] Modal → operatives=4, start=now, finish=now+2min. Submit.
- [ ] **Expected:** row in `live_site_activity` with `status='active'`.
- [ ] Open `/site-manager/:projectId` in another tab as User A → pin appears within 8s.
- [ ] Open the 3D BIM viewer if you have an IFC mapped → that zone turns **orange (pulsing)**.

## Test 7 — Overtime banner

- [ ] Wait for the finish time from Test 6 to pass.
- [ ] **Expected:** red banner on site manager view; toast fires once.

## Test 8 — Checkout / diary

- [ ] Back on DABS as User B, click **Close Out Today's Shift**.
- [ ] Set completion=100, progress=completed, note "test", upload a JPG. Submit.
- [ ] **Expected:** row in `daily_site_diaries` (qs_status=pending, ifc_synced=false); `live_site_activity.status='archived'`; pin gone from live view; diary appears in QS Queue.

## Test 9 — QS role gate

- [ ] While still signed in as User B (subcontractor), open browser devtools and manually call `setDiaryQsStatus` from React Query devtools **or** as User A (`master_admin`) — try approving your own diary.
- [ ] Log in as User B via a different browser and try to approve.
- [ ] **Expected as User B:** toast "Forbidden: QS approval requires site_manager, project_admin, or master_admin role.". Nothing changes in DB.
- [ ] **Expected as User A:** approval succeeds.

## Test 10 — Cumulative progress math (the important one)

Two scenarios. Test each on a fresh zone.

**Scenario A — Reaches 100 in two hits:**
- [ ] User B drops a pin on Zone A, closes out with **60%** approved.
- [ ] User A (as QS/master) approves.
- **DB check:** `SELECT total_pct FROM zone_approved_completion('<projectId>') WHERE zone_id='<zoneA>';` → **60**.
- [ ] Zone A in BIM viewer: **grey with a 60% orange progress bar**.
- [ ] User B drops another pin on Zone A, closes out with **50%**. Approved.
- **DB check:** total_pct → **100** (capped).
- [ ] All approved diaries for Zone A now have `ifc_synced=true`.
- [ ] Zone A in BIM viewer: **solid green**, progress bar shows 100%.

**Scenario B — Stays partial:**
- [ ] Same steps but 40% then 30%. Approved.
- **DB check:** total_pct → **70**.
- [ ] Zone B in BIM viewer: **grey with a 70% progress bar**. Not green.

## Test 11 — IFC upload + mapping

- [ ] Upload a small `.ifc` file via the BIM uploader.
- [ ] Open Mapping Editor → Scan Model → assign one GlobalId to your test zone → Save.
- [ ] **Expected:** the mesh you mapped is coloured per the zone state above.

## Test 12 — Delete project

- [ ] From HUD → Delete Project → type name → confirm.
- [ ] **Expected:** project row gone; downstream rows cascade-deleted. If FK constraint error, the cascade isn't set on some FKs — file a bug.

---

## Regression checklist for future changes

After any code change that touches `daily_site_diaries`, `live_site_activity`, or `work_zones`, re-run **Tests 6, 8, 9, 10** at minimum.

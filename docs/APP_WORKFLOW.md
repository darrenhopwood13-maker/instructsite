# Site Operations Oracle — How the app actually works

Written after a full code audit. Plain English, one section per workflow. If anything here doesn't match what you see on screen, the screen is the source of truth and this doc is wrong — tell the AI and it'll be corrected.

---

## 0 · Roles at a glance

Four roles live in `user_roles` (global) and `project_members.role_on_project` (per-project):

| Role | Can do |
|---|---|
| `master_admin` | Create/delete projects, create zones, manage everything |
| `project_admin` | Manage a specific project's members and settings |
| `site_manager` | Approve/reject diaries in the QS queue |
| `subcontractor` | Drop DABS pins, complete their own diary at checkout |

**Bootstrap rule (after this sprint):** the very first person to sign up becomes `master_admin` automatically. Every subsequent sign-up gets **no role** until a master admin invites/grants one. There is no more dev auto-promote.

**DB check:** `SELECT user_id, role FROM user_roles;`

---

## 1 · Create a project

**Route:** `/projects` → click **New Project** → fills `/projects/new` form → submit → redirects to `/projects/:id`.

Only masters see the New Project button. On submit the server:
1. Inserts a row in `projects` (name, address, scope, master/admin IDs = you).
2. Inserts you into `project_members` as `project_admin`.
3. Any files you dropped in the wizard are stored in the `project-bible` bucket and registered as `site_documents`.

**DB check:** `SELECT id, name, master_admin_id FROM projects ORDER BY created_at DESC LIMIT 5;`

---

## 2 · Upload a drawing pack

**Where:** on `/projects/:id`, the drawings DropZone.

Drop a multi-page PDF. Behind the scenes:
1. The raw PDF is uploaded to `project-bible/{userId}/{projectId}/raw_incoming_packs/…`.
2. The server splits it page-by-page with `pdf-lib`, re-uploads each page to `project-bible/{userId}/{projectId}/drawing/pages/…`.
3. For each page it inserts one row into `site_documents` and one into `project_drawings`.
4. Each page is sent to **Gemini 2.5 Pro** with a structured schema — the AI extracts `drawing_no`, `revision`, `title`, `level`, `zone`, `zones[]`.
5. **Zones found on the drawings are auto-created in `work_zones`** with `source="drawing"`. This is why zones appear right after upload.
6. The raw pack is deleted.

Each drawing is viewable in the on-page canvas with pan/zoom. Pins are laid over as % coordinates.

**DB check:** `SELECT drawing_no, title, extraction_status FROM project_drawings WHERE project_id = '<id>';`

---

## 3 · Oracle (AI assistant)

**Route:** `/oracle`.

Six command buttons (installation / safety / procurement / drawing / snag / assist). Each one grabs the most recent site documents, chunks their extracted text, picks the top-scoring keyword snippets, and asks Gemini 2.5 Pro to answer as a senior construction expert.

**Known gap (still open — P1):** Oracle currently reads across **all** projects because there's no `project_id` filter on the document lookup. The "Lock to Oracle" button on a project page stores context in `sessionStorage` but Oracle doesn't read it yet.

---

## 4 · Work zones

Zones are how the app links a physical part of the building to progress. There are three ways they get created:
- **From drawings** (auto, `source="drawing"`).
- **From a logistics plan upload** (auto, `source="logistics"`).
- **Manual** from the Master Admin HUD (`source="manual"`).

The Zone Map on the project page is a coloured card grid — not a real geographical map. Masters can toggle a zone open/closed.

---

## 5 · DABS (pin drop at start of shift)

**Route:** `/dabs/:projectId`.

The subcontractor:
1. Picks a zone + trade package.
2. Clicks on the drawing to drop a pin.
3. Modal captures operative count, start time, scheduled finish.
4. On submit, a row is created in `live_site_activity` with `status='active'`.

**Immediately:**
- The site manager view shows the pin on the drawing (realtime + 8s polling).
- The 3D BIM viewer turns the corresponding zone **orange (pulsing)** because there is now a live pin on that zone.

**Note:** The `activities` and `permits` tables in the schema are **not currently wired** into the DABS flow. That's tracked as P1 in the roadmap.

**DB check:** `SELECT trade_package, zone_id, status FROM live_site_activity WHERE project_id = '<id>' AND status = 'active';`

---

## 6 · Site Manager view

**Route:** `/site-manager/:projectId`.

Shows:
- Active pins on the drawing.
- Stat cards: active pins, operatives on site, overtime, archived today.
- Red banner + toast when any pin passes its `scheduled_finish`.
- QS Verification Queue (Section 8).
- 3D BIM viewer (Section 9).

Clicking a pin shows the crew popover. "Clear Crew Out" here closes the pin only — it does **not** create a diary. Only the subcontractor's own checkout creates a diary.

---

## 7 · Daily diary (checkout)

This is where DABS becomes a permanent record. **The site manager does not type the diary — the subcontractor does.**

Flow: the subcontractor opens `/dabs/:projectId`, clicks **Close Out Today's Shift**. The Checkout modal asks for four manual fields — progress status (completed / partial / not_completed), completion % (0-100 slider), notes, optional photos.

On submit the server:
1. **Auto-copies from the live pin:** project_id, live_activity_id, drawing_id, zone_id, trade_package, operative_count, start_time, scheduled_finish.
2. **Auto-computes:** checkout_time = now, hours_logged = (checkout − start) / 1h.
3. **Adds manual fields** from the modal.
4. Inserts into `daily_site_diaries` with `qs_status='pending'`, `ifc_synced=false`.
5. Sets `live_site_activity.status='archived'` — pin disappears from live view; diary appears in QS queue.

**Photos** go to the `diary-photos` bucket at `{project_id}/{pin_id}/{uuid}.jpg`.

**DB check:** `SELECT trade_package, completion_pct, qs_status, ifc_synced FROM daily_site_diaries WHERE project_id = '<id>' ORDER BY checkout_time DESC LIMIT 10;`

---

## 8 · QS Verification queue

The QS panel on the Site Manager page lists every diary. For each pending one, the QS clicks **Approve** or **Reject**.

**After this sprint the server enforces:** only `site_manager`, `project_admin`, or `master_admin` can call the approve/reject function. Subcontractors trying to self-approve get a hard `403`.

---

## 9 · The green-mesh moment (cumulative progress math)

**This is the biggest logic change in this sprint.**

Old behaviour: a diary only marked its zone "complete" if its own `completion_pct` was exactly 100 at the moment of approval. Partial completions could never make a zone green.

New behaviour (cumulative):
1. Every time a diary is approved, a DB trigger re-tallies the **sum of `completion_pct` across all approved diaries for that zone**.
2. If the sum reaches **100 or more**, every approved diary for that zone is marked `ifc_synced=true` in one go.
3. The BIM viewer reads the cumulative total from a helper called `zone_approved_completion` and colours each zone:
   - `progress_pct >= 100` → **solid green** (complete)
   - has a live pin → **pulsing orange** (live)
   - otherwise → **translucent grey** (unstarted)
4. The viewer also shows a **progress bar per zone** in the legend so you can see partial progress at a glance (e.g. "Level 02 Core: 70%").

**Example:** Zone A gets three approved diaries of 40%, 30%, 30%. Sum = 100. Mesh flips green.

**DB check for the tally:** `SELECT * FROM zone_approved_completion('<projectId>');`

---

## 10 · Master Admin HUD

Only visible to `master_admin`. Three functions today:
- Delete project (typed-name confirmation, cascades related rows).
- Create work zone manually.
- Toggle zone status open/closed.

---

## 11 · What's still not built (see IMPROVEMENT_ROADMAP.md)

- The `activities` + `permits` tables and the `high_risk_flags` auto-permit trigger are in the schema but nothing calls them from the UI yet.
- Oracle isn't project-scoped.
- QS still can't see photo evidence (only a photo count badge).
- No proper login page yet — the app signs everyone in anonymously.

Everything in this document reflects the code **as of this sprint**.

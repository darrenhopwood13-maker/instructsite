# Site Operations Oracle — The Complete Workflow Bible

> Written to be read top-to-bottom by someone who has never seen the app before. Every screen, every button, every database side-effect. If the screen ever disagrees with this doc, the screen wins and this doc is wrong — tell the AI and it'll be corrected.

**Golden rule of the whole app:** the **DABS pin** (drop-a-blob-on-site) that a subcontractor drops at the start of their shift is the **single source of truth** for who is on site, where they are, and what they're doing. Everything downstream — the site manager's diary, the QS approval queue, the cumulative progress that turns the 3D model green — is a consequence of that pin being dropped and later closed out.

---

## 0 · Roles, in one table

Roles live in two tables. `user_roles` is your **global** role. `project_members.role_on_project` is your **per-project** role. Most permission checks care about the per-project role first, then fall back to the global role.

| Role | What they do | Where they see it |
|---|---|---|
| `master_admin` | God mode. Creates projects, deletes projects, grants roles, creates zones, sees the Portfolio dashboard across every project. | Everywhere. Sees the Master Admin HUD on every project page. |
| `project_admin` | Runs one specific project. Invites members, uploads drawings, approves diaries, force-checks-out crews. | Their project pages. |
| `site_manager` | Approves/rejects diaries in the QS queue. Issues permits for high-risk work. Cannot delete projects. | Site Manager view for their projects. |
| `subcontractor` | The people actually doing the work. Drop DABS pins at the start of their shift, close them out at the end (which auto-writes the diary). | DABS page + their own subcontractor cockpit. |

**Bootstrap:** the very first user to sign up automatically becomes `master_admin` (trigger: `bootstrap_first_master_admin`). Every user after that starts with **no role** and must be granted one.

DB check: `SELECT user_id, role FROM user_roles;`

---

## 1 · Preview password gate (currently disabled in preview)

Two layers were built:

1. **Site-wide gate** — everyone lands on `/unlock` and must enter `SITE_PASSWORD` before any route renders.
2. **Invite gate** — subcontractors clicking a QR / invite link must enter the same password a second time before they see the onboarding page.

Both are wired but **turned off in the Lovable preview** because the h3 session cookie doesn't survive the preview iframe's cross-site cookie rules. They will be re-enabled on the published `.lovable.app` domain where cookies work normally. The `SITE_PASSWORD` and `SITE_GATE_SESSION_SECRET` secrets are already set.

---

## 2 · Creating a project (master admin only)

**Route:** `/projects` → **New Project** → fills `/projects/new` → submit → redirects to `/projects/:id`.

What happens under the hood on submit:

1. Row inserted into `projects` (name, address, scope, `master_admin_id` = you, `created_by` = you).
2. Row inserted into `project_members` making you `project_admin` of the new project.
3. Any files dropped in the wizard are uploaded to the `project-bible` storage bucket and registered as `site_documents`.

DB check: `SELECT id, name, master_admin_id FROM projects ORDER BY created_at DESC LIMIT 5;`

---

## 3 · Uploading a drawing pack — the AI-driven ingestion pipeline

**Where:** on `/projects/:id`, the Drawings DropZone.

You drag in a multi-page PDF (typical architectural pack, up to a few hundred pages). This is the most complex ingestion path in the app, so here is exactly what fires:

1. **Raw upload** — the whole PDF is uploaded to `project-bible/{userId}/{projectId}/raw_incoming_packs/{uuid}.pdf`.
2. **Page splitting** — the server opens the PDF with `pdf-lib`, splits it into single-page PDFs, and uploads each page to `project-bible/{userId}/{projectId}/drawing/pages/page-N.pdf`.
3. **DB registration** — for every page, one row is inserted into `site_documents` (the generic document ledger) and one into `project_drawings` (the drawing-specific row with title/rev/level/zone columns).
4. **AI extraction** — each single-page PDF is streamed to **Gemini 2.5 Pro** through the Lovable AI Gateway with a structured JSON schema. The AI returns `{ drawing_no, revision, title, level, zone, zones[] }`. Those fields are written back onto the `project_drawings` row and `extraction_status` flips from `pending` → `complete` (or `failed`, if the AI couldn't read it).
5. **Zone auto-creation** — any zone names the AI finds on the drawings are automatically inserted into `work_zones` with `source='drawing'`. **This is why zones appear in the Zone Map immediately after upload with no manual work.**
6. **Cleanup** — the raw multi-page pack is deleted from storage. Only the per-page PDFs remain.
7. **Canvas rendering** — the drawing viewer lazy-renders each page PDF to a canvas image (via the recently patched `DrawingCanvas` component). Pan/zoom is supported.

DB checks:
```sql
SELECT drawing_no, title, extraction_status FROM project_drawings WHERE project_id='<id>';
SELECT name, level, source FROM work_zones WHERE project_id='<id>';
```

**Recovery if extraction fails:** the drawing still lives in storage and is viewable — only the AI metadata is missing. You can retry extraction, or type in `drawing_no`/`title` manually via SQL.

---

## 4 · Work zones — the physical building broken into named pieces

A "zone" is a labelled chunk of the building (e.g. "L02 Core", "Basement Plantroom", "Zone A / Level 01"). Zones matter because everything else — pins, diaries, the 3D mesh, progress percentages — is tallied **per zone**.

Three ways a zone gets created:

| Source | How | `source` column value |
|---|---|---|
| Auto from drawings | Gemini reads zone labels off each page during ingestion | `drawing` |
| Auto from logistics plan | Uploading a logistics plan PDF triggers a second AI pass that also extracts zones | `logistics` |
| Manual | Master admin creates a zone from the Master Admin HUD on the project page | `manual` |

The **Zone Map** on the project page is a coloured card grid (it's not a real geographical map — it's a labelled matrix). Master admins can toggle each zone open/closed. Closed zones reject new pins.

---

## 5 · Registering a subcontractor company (the bit you asked about)

**Route:** `/subcontractors/new` — accessed from the **Full Registry** link inside the **Trade Directory** panel on the project page.

The form captures:

- **Company details:** legal name, trading name, company registration number, VAT number, insurance details, HQ address.
- **Project Manager (office contact):** name, mobile, email — the person in the subcontractor's office who quotes and coordinates.
- **Site Supervisor (on-site contact):** name, mobile, email — the person actually on site who will use the mobile cockpit.
- **Trade packages:** what they're being brought in to do (e.g. `Steelwork`, `M&E`, `Groundworks`).

On submit — clicking **"Save Partner & Generate Access Tokens"**:

1. A row is written to `subcontractor_invites` with a hashed token, an expiry, and the full company/contact block.
2. The success pane shows two things:
   - The **onboarding invite link** (`/invite/{token}`) which you can copy or email.
   - The **QR code SVG** for the site supervisor to scan with their phone.
3. When the supervisor scans the QR / opens the link, they land on `/invite/{token}`. They sign in (or sign up), the `accept_subcontractor_invite` DB function verifies the token, inserts them into `project_members` with `role_on_project='subcontractor'`, and grants them the global `subcontractor` role. They're then redirected into their DABS page for that project.

**This is the ONLY way a subcontractor gets access to a project.** Without registering the company here and sending the QR/link, anyone who scans a random code has no account and no access.

---

## 6 · DABS — the pin drop that starts everything

**Route:** `/dabs/:projectId` (the subcontractor's mobile cockpit).

At the start of a shift, the site supervisor / operative:

1. Picks the **zone** they'll be working in.
2. Picks the **trade package** they're on.
3. Taps on the drawing where the work is happening — this drops a pin at that exact `(x%, y%)` coordinate.
4. In the modal, enters: **operative count**, **start time** (defaults to now), **scheduled finish time**, optional notes.
5. Submits.

Server side (`createLivePin`):

- One row is inserted into `live_site_activity` with `status='active'`, coordinates as percentages, all the fields above, `subcontractor_id = auth.uid()`.
- The `detect_pin_high_risk` trigger scans `trade_package` and `notes` for hot works / confined space / working at height / excavation keywords. If any match, `high_risk_flags` is populated and `permit_status` flips to `required`.
- The `auto_flag_permit_required` trigger double-checks the permit state.

**Immediately:**

- The **site manager view** starts showing the pin on the drawing (realtime + 8s polling fallback).
- The **3D BIM viewer** turns that zone **pulsing orange** — "live activity here".
- Stat cards on the site manager view increment: active pins, operatives on site.
- If `permit_status='required'`, a red **Permit Required** ribbon appears on the pin. The pin cannot legally be worked until a manager issues a permit via `issue_pin_permit` (permit type is derived from the first `high_risk_flags` entry, e.g. `working_at_height`).

Then the crew actually works. Nothing else happens automatically until the shift ends.

DB check: `SELECT trade_package, zone_id, status, permit_status, high_risk_flags FROM live_site_activity WHERE project_id='<id>' AND status='active';`

---

## 7 · Site Manager view — command tower for one project

**Route:** `/site-manager/:projectId`.

Panels on this page:

- **Live pins** overlaid on the drawing (zoom, pan, click pin → crew popover).
- **Stat cards:** active pins, operatives currently on site, overtime pins, diaries archived today.
- **Overtime banner + toast** — fires the moment any active pin's `scheduled_finish` passes without a checkout. Red top banner + single toast per pin so you know a crew is running late.
- **QS Verification Queue** — see §9.
- **3D BIM viewer** — see §10.
- **Force Checkout button** on any pin — see §8b.

Clicking a pin shows the crew popover with operative count, start time, scheduled finish, and a "Clear Crew Out" button. **"Clear Crew Out" here only closes the pin** — it does NOT create a diary. Only the subcontractor's own checkout, or a manager **force checkout**, creates a diary row.

---

## 8 · Closing out — how DABS becomes the site manager's diary automatically

This is the crucial part you asked about. **The site manager never types the diary.** The subcontractor types four fields on their phone at checkout, and everything else is copied automatically from the live pin.

### 8a · Normal checkout (subcontractor themselves)

The subcontractor opens `/dabs/:projectId`, taps **Close Out Today's Shift**. Modal asks for exactly four things:

1. **Progress status** — `completed` / `partial` / `not_completed` (radio).
2. **Completion %** — 0-100 slider.
3. **Notes** — free text.
4. **Photos** — optional upload, multiple.

On submit, the server function does the following atomically:

1. **Auto-copies from the live pin (nothing typed by anyone):**
   - `project_id`, `live_activity_id`, `subcontractor_id`, `drawing_id`, `zone_id`, `trade_package`, `operative_count`, `start_time`, `scheduled_finish`.
2. **Auto-computes:**
   - `checkout_time = now()`
   - `hours_logged = (checkout_time − start_time) / 3600`, rounded to 2dp.
3. **Adds the four manual fields** from the modal.
4. **Uploads photos** to the `diary-photos` bucket at `{project_id}/{pin_id}/{uuid}.jpg` and stores their public paths in `photo_urls[]`.
5. **Inserts a row into `daily_site_diaries`** with `qs_status='pending'` and `ifc_synced=false`.
6. **Marks the pin archived** — `live_site_activity.status='archived'`.

The instant that runs:

- The pin disappears from the live drawing view.
- A new row appears in the QS Verification Queue tagged **PENDING**.
- The 3D BIM viewer stops showing that zone as pulsing orange (no more live activity there), but the zone stays grey until cumulative progress hits 100% (see §10).

DB check: `SELECT trade_package, completion_pct, qs_status, ifc_synced, photo_urls FROM daily_site_diaries WHERE project_id='<id>' ORDER BY checkout_time DESC LIMIT 10;`

### 8b · Manager force checkout (crew left site without closing)

If a crew walks off without hitting "Close Out", the manager can force it. On the site manager view, click a pin → **Force Checkout**. The `manager_force_checkout` DB function:

1. Verifies the caller is `master_admin` / `project_admin` / `site_manager` — hard `403` otherwise.
2. Copies exactly the same auto-fields as a normal checkout.
3. Uses `progress_status` derived from the manager's typed completion % (`>=100`=completed, `>0`=partial, `0`=not_completed).
4. Writes the diary row with `manager_force_closed=true` and `force_closed_by = auth.uid()` so the QS can see it wasn't a self-checkout.
5. Archives the pin.

The QS still has to approve/reject the diary the same way.

---

## 9 · QS Verification Queue — approving the diary and moving to "done"

The QS panel on the site manager page lists every diary. Each pending row shows: trade, zone, drawing, operatives, hours, completion %, notes, photo count. QS clicks **Approve** or **Reject**.

**Role gate (enforced server-side):** only `site_manager` / `project_admin` / `master_admin` can approve or reject. A subcontractor trying to self-approve via a crafted request gets a hard `403` from `setDiaryQsStatus`.

On **Approve**:

1. `qs_status='approved'` on the diary row.
2. Trigger `sync_zone_ifc_on_approval` fires (see §10).

On **Reject**: `qs_status='rejected'` — no downstream progress effect. The subcontractor can re-submit corrections (future work).

---

## 10 · Cumulative progress + the green-mesh moment

This is the biggest piece of business logic in the app and the reason for keeping DABS strict.

**Old (bad) behaviour:** a zone only went green if a single diary hit exactly 100%. Two 50% diaries would leave the zone grey forever.

**Current (correct) behaviour — cumulative:**

1. Every time a diary is approved, the trigger `sync_zone_ifc_on_approval` re-tallies `SUM(completion_pct)` across all approved diaries for that `(project_id, zone_id)`.
2. If the sum is `>= 100`, every approved diary for that zone is bulk-updated with `ifc_synced=true`.
3. The 3D viewer reads the cumulative total via the SQL helper `zone_approved_completion(_project_id)` and colours each zone mesh:
   - `progress_pct >= 100` → **solid green** (complete)
   - has a live pin right now → **pulsing orange** (live)
   - otherwise → **translucent grey** (unstarted or partial)
4. The zone legend shows a **progress bar per zone** so partial state is still visible at a glance (e.g. "L02 Core: 70%").

**Worked example:**
- Zone A gets three diaries approved at 40%, 30%, 30%. Sum = 100. Every one of them flips `ifc_synced=true`. Mesh goes green.
- Zone B gets 40% + 30%. Sum = 70. Nothing flips. Mesh stays grey with a 70% bar in the legend.

DB check for the tally: `SELECT * FROM zone_approved_completion('<projectId>');`

---

## 11 · Permits, high-risk flags, activities

Two tables that most users never see but which back the safety flow:

- `activities` — the "real" activity record. Currently mostly created by `issue_pin_permit` when a manager issues a permit tied to a live pin.
- `permits` — one row per issued permit, with `permit_type` (e.g. `working_at_height`, `hot_works`), `valid_from`, `valid_to`, `issued_by`, `status`.

Flow: subcontractor drops a pin whose text triggers a high-risk keyword → pin's `permit_status` becomes `required` → manager clicks **Issue Permit** on the site manager view → `issue_pin_permit` creates the activity + permit rows and flips `permit_status` to `active` → work is legal.

---

## 12 · The 3D BIM viewer (IFC)

**Where:** Site Manager page, BIM panel.

Upload path: **BimModelUploader** → `.ifc` file → uploaded to `project-bim-models/{projectId}/{uuid}.ifc` → registered in `project_ifc_models`. Uploading a new model marks it active and deactivates the previous one.

Mapping path: **BimMappingEditor** → "Scan Model" reads GlobalIds from the IFC via `web-ifc.wasm` → assign one or more GlobalIds to a `work_zone` → save into `ifc_element_mappings`.

Colouring at runtime: for each zone, the viewer looks at (a) whether any live pin sits in that zone → orange pulse; (b) `zone_approved_completion` → solid green if `>=100`, otherwise translucent grey with a % progress bar in the legend.

---

## 13 · Director's Portfolio dashboard

**Route:** `/dashboard` (master admin only).

Three sections:

- **A — Portfolio grid:** every project as a card with name, address, active pin count, overtime count, cumulative completion %.
- **B — Teleport button** on each card: routes straight into that project's Site Manager Control Tower.
- **C — Global safety alert stream:** vertical timeline of all live alerts across every project (overtime, permits requested, permit expiries, high-risk flags).

Data comes from `src/lib/portfolio.functions.ts`.

---

## 14 · Oracle (AI assistant)

**Route:** `/oracle`. Six command chips (installation / safety / procurement / drawing / snag / assist). Each grabs recent site documents, extracts text, picks top-scoring keyword snippets, and asks Gemini 2.5 Pro to answer as a senior construction expert.

**Known gap:** Oracle currently reads across **all** projects because there's no `project_id` filter on the document lookup. The "Lock to Oracle" button stashes context in `sessionStorage` but Oracle doesn't read it yet. This is on the roadmap (P1).

---

## 15 · Master Admin HUD

Only visible if you have `master_admin`. Sits on every project page. Functions:

- **Delete Project** — typed-name confirmation, cascades all child rows.
- **Create Work Zone** — manual zone entry (`source='manual'`).
- **Toggle Zone Status** — open/closed.
- **Grant Roles** — assign `site_manager` / `project_admin` / `subcontractor` to a user id.

---

## 16 · End-to-end example, all in one paragraph

Master admin creates project "26 Stanley Road". They drop the drawing pack — Gemini extracts every page's drawing_no/title and auto-creates zones L00–L05. They upload the IFC model, map three GlobalIds to "L02 Core". They go to Trade Directory → Full Registry → register "WestShore Steel Erectors" with company details + Site Supervisor "Dave". They copy the QR and email it to Dave. Dave scans, signs in, lands on his DABS cockpit. On Monday 7am Dave picks L02 Core + "Steelwork", taps the drawing, enters 6 operatives + finish 3pm, drops the pin. The zone pulses orange in the 3D viewer. At 3:15pm Dave closes out with 40% complete + one photo. Diary appears in the QS queue. The site manager approves. `zone_approved_completion` says 40%; the mesh stays grey with a 40% legend bar. Tuesday: another WestShore crew drops a pin, closes out at 35%. Approved. Sum = 75. Grey with 75% bar. Wednesday: 30% more → sum caps at 100 → every approved diary for L02 Core flips `ifc_synced=true` → mesh goes solid green. Director opens `/dashboard`, sees 26 Stanley Road with an updated portfolio completion figure, clicks Teleport, lands on the site manager view.

That is the entire happy path.

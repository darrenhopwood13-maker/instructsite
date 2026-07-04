# Master Project Setup & Document Mapping — Build Plan

## Scope confirmed
- End-to-end: wizard + uploads + DABS drawing dropdown + zone mapping + permit-required trigger + Site Manager alert.
- Drawing parsing: **Full AI parse** — title block (drawing no, rev, scale, title) + attempt to extract levels/zones. Gemini 2.5 Pro vision, first page rendered to image.
- High-risk triggers: **Working at Height, Hot Works, Confined Space**.
- Admin tiers question was skipped — I will assume: **Master Admin** (workspace-wide, can create projects, assign Project Admins) and **Project Admin** (manages one project). Confirm or correct in reply.

## 1. Schema (single migration)

New enum + tables (all with GRANTs, RLS, owner + role policies, `updated_at` triggers):

- enum `app_role`: `master_admin`, `project_admin`, `site_manager`, `subcontractor`
- `user_roles` (user_id, role) + `has_role()` security-definer function
- `projects` — name, address, brief, created_by, master_admin_id, project_admin_id
- `project_members` — project_id, user_id, role_on_project
- `project_drawings` — project_id, site_document_id, drawing_no, revision, title, scale, level, zone, extraction_status, is_active
- `logistics_plans` — project_id, site_document_id, extracted_zones jsonb, extraction_status
- `work_zones` — project_id, name, level, source (`logistics` | `drawing` | `manual`)
- `rams_documents` — project_id, site_document_id, trade_package, high_risk_flags text[] (WAH/Hot/Confined), permit_required bool
- `activities` — project_id, subcontractor_id, drawing_id, zone_id, description, high_risk_flags text[], permit_status (`none`|`required`|`active`|`expired`), created_at
- `permits` — project_id, activity_id, permit_type, issued_by, valid_from, valid_to, status

Storage: reuse `project-bible` bucket; add per-project path prefix `{projectId}/drawings/…`, `/logistics/…`, `/rams/…`. Policies scope by `uploaded_by = auth.uid()` + membership check.

## 2. AI extraction (server functions)

- `extractDrawingTitleBlock(documentId)` — render page 1 of PDF to image server-side (pdfjs → canvas via `@napi-rs/canvas` is Worker-unsafe; use pdfjs-dist `getPage().render()` to an OffscreenCanvas polyfill fallback → if not viable in Worker runtime, use Gemini file input directly with the PDF bytes as base64). Ask Gemini 2.5 Pro for JSON `{drawing_no, revision, title, scale, level, zones[]}`. Persist to `project_drawings`; upsert `work_zones` rows for extracted zones.
- `extractLogisticsZones(documentId)` — same PDF-to-model flow; ask for `zones[]` with `{name, level}`. Persist to `logistics_plans.extracted_zones` and upsert `work_zones`.
- Both re-use the auth middleware; run inline after upload (fire-and-forget from client; UI shows status column).

## 3. UI

Design: black/white grid, thin 1px hairline borders, orange (#F97316) accent, uppercase micro-labels, monospaced drawing numbers. Drop-zones with dashed borders, corner brackets.

Routes (all under `_authenticated`):
- `/projects` — list + "New Project" (master_admin only)
- `/projects/new` — wizard: 3 steps (Details → Admins → Upload zones)
- `/projects/$projectId` — project home
- `/projects/$projectId/drawings` — GA drawings table w/ AI status
- `/projects/$projectId/logistics` — logistics doc + extracted zones
- `/projects/$projectId/rams` — RAMS repo, per trade package, high-risk flag chips
- `/dabs/$projectId` — subcontractor DABS: active drawing dropdown, activity form, high-risk checkboxes → auto permit-required banner
- `/site-manager/$projectId` — dashboard with **flashing** "Permit Required" alert (CSS `@keyframes` pulse on orange) listing activities where `permit_status = 'required'`

Components: `DropZone`, `DrawingCard`, `PermitAlert`, `ZoneSelect`, `TradePackagePicker`.

## 4. Workflows

- On activity insert: DB trigger — if `high_risk_flags` non-empty AND no active permit for that activity's package → set `permit_status = 'required'`.
- Site Manager dashboard polls (or realtime subscribe) `activities` where `permit_status='required'`, renders flashing card.
- DABS dropdown = `project_drawings` where `project_id = current AND is_active = true`.
- Zone mapping = when activity references a drawing with a `level`/`zone`, prefill `zone_id`.

## 5. Verification

- Run migration.
- Seed the current signed-in user as `master_admin` if no master_admin exists (idempotent server fn callable once).
- Upload one GA PDF → confirm `project_drawings` gets title block.
- Toggle "Working at Height" on activity → alert flashes on site manager view.

## Technical notes (for the technical reader)

- PDF → image inside a Cloudflare Worker: `pdfjs-dist` legacy build works but is heavy. Fallback path — send the PDF directly as multimodal file input (`type: "file"`) to Gemini 2.5 Pro; skips the render step entirely and still works for title-block extraction. This is what I'll implement.
- Realtime for permit alerts uses `supabase.channel('activities').on('postgres_changes', …)` in the site-manager page.
- All new server fns use `requireSupabaseAuth`; role checks via `has_role(auth.uid(), 'master_admin')`.

## What I need from you before building

1. Confirm the two admin tiers (Master Admin / Project Admin) or supply your own definitions.
2. Confirm you want me to auto-promote the current signed-in user to `master_admin` (otherwise there's no one who can create the first project).

Approve and I'll ship the migration first, then the code in one pass.

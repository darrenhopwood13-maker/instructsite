
## Goal

Replace the small scrollable "results" modals across instructSite with a
full-screen, sectioned, on-brand **Report Viewer** that ships with a proper
action bar (Download PDF · Share · Print · Add to Project Bible) and fires a
notification to a project's PMs/members whenever a report is filed into the
Bible.

## Report surfaces this replaces

| Surface | Today | After |
|---|---|---|
| Oracle Tooling result modal (`src/pages/Oracle.tsx`) | `max-w-2xl` glass modal, `max-h-[60vh] overflow-y-auto` | Full-screen Report Viewer, markdown split into collapsible sections |
| Snag report (`ReportView` in `snags.new.tsx`, reused in `snags.$snagId.tsx`) | Inline card list | Same content wrapped in the Report Viewer shell + action bar |
| Programme playbook results (`programme.$projectId.tsx`) | Existing panels | Wrapped in Report Viewer shell + action bar |

Any future "result set" surface just renders `<ReportViewer />` and drops in
`<ReportSection />` children — one place to keep the theme consistent.

## New component: `<ReportViewer />`

Location: `src/components/reports/ReportViewer.tsx`

Structure (theme = glass-panel, aurora bg, Zen Dots titles, alert-orange accents):

```text
┌───────────────────────────────────────────────────────────────────────┐
│ Kicker                          [ PDF ] [ Share ] [ Print ] [ +Bible ]│
│ TITLE (Zen Dots)                                              [ Close]│
│ subtitle · meta                                                       │
├───────────────────────────────────────────────────────────────────────┤
│  ┌─ Section 1 ─────────────────────────────────── ▼ ─┐                │
│  │  markdown / children                              │                │
│  └───────────────────────────────────────────────────┘                │
│  ┌─ Section 2 ─────────────────────────────────── ▶ ─┐                │
│  └───────────────────────────────────────────────────┘                │
└───────────────────────────────────────────────────────────────────────┘
```

- `fixed inset-0 z-[80]` overlay, aurora + grain background, `<main>` scroll
  container so the browser owns page scroll (no nested `overflow-y-auto`
  window).
- `Escape` closes; `body` scroll locked while open.
- Actions live in a sticky top-right toolbar; the same actions repeat in a
  bottom-right floating cluster for long reports.

Sub-component `<ReportSection title icon defaultOpen>` — bordered card built
on `<details>` for zero-JS collapse, animated chevron.

Sub-component `<MarkdownReport content sections?>` — when a caller provides
raw markdown, we auto-split on H2 (`## …`) into sections; otherwise the caller
composes `<ReportSection>` children directly (used by snag report).

## Actions

- **Print** — `window.print()` with a `@media print` stylesheet in
  `src/styles.css` that expands every `<details>` to open, hides the app nav,
  and prints only the report body.
- **Download PDF** — client-side via `jspdf` + `html2canvas` (both single-shot
  browser libs, safe on Cloudflare because they only run client-side).
  Snapshots the report body, paginates onto A4, saves as
  `<report-title>.pdf`. Install with `bun add jspdf html2canvas`.
- **Share** — Web Share API when available (`navigator.share`); fallback
  copies "Title\n\n<location.href>" to clipboard and shows a toast. Public
  Oracle results have no shareable URL, so Share disables itself for those
  and just copies the title + summary.
- **Add to Project Bible** — see below. Disabled until a `projectId` is
  known.

## Add-to-Bible pipeline

New server function `addReportToProjectBible` in
`src/lib/project-bible.functions.ts`:

Inputs (validated with Zod):
- `projectId`, `title`, `category` ("Oracle" | "Snag" | "Programme" |
  "Custom"), `markdown` (or `html`), optional `sourceUrl`.

Handler:
1. `requireSupabaseAuth` → verify caller is a project member via existing
   `is_project_member` RPC.
2. Server-side render the markdown to a lightweight PDF using `jspdf` (no
   headless browser, no native binaries — Worker-safe).
3. Upload to bucket `project-bible` at
   `bible-reports/<projectId>/<timestamp>-<slug>.pdf`.
4. Insert a `site_documents` row (`bucket=project-bible`, `mime_type=application/pdf`,
   `extraction_status='ready'`, `uploaded_by=auth.uid()`).
5. Link the doc to the project so it shows up in the Project Bible list. The
   existing bible list unions `project_drawings` / `logistics_plans` /
   `rams_documents` / `programme_uploads`. To keep the list generic, add a
   new join table `project_bible_reports` (project_id, site_document_id,
   category, source, created_by) with RLS + GRANTs, and extend
   `listProjectBibleDocuments` to union this table as `category='Report'`.
6. Fan out notifications (see next section).

Returns `{ documentId, siteDocumentId }` so the UI can toast "Filed in
Project Bible" with a direct link to `/projects/{projectId}/bible`.

## Notifications system

New `notifications` table:

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | recipient (`auth.users.id`) |
| project_id | uuid nullable | scope for filtering |
| kind | text | e.g. `report_added_to_bible` |
| title | text | headline shown in the bell |
| body | text | short description |
| link_to | text nullable | in-app URL |
| read_at | timestamptz nullable | |
| created_at / updated_at | timestamptz | |

Grants + RLS (per `<public-schema-grants>` rules):
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated`
- `GRANT ALL … TO service_role`
- Policies: users can select/update their own row (`auth.uid() = user_id`);
  inserts happen via `service_role` from server functions.

New server functions in `src/lib/notifications.functions.ts`:
- `listMyNotifications({ limit? })`
- `markNotificationRead({ id })` and `markAllNotificationsRead()`
- Internal helper `fanoutProjectNotification(projectId, payload)` used by
  `addReportToProjectBible`, which:
  - Selects project managers/members from `project_members` **and** the
    project's `master_admin_id` / `project_admin_id` columns.
  - Inserts one notification row per recipient with
    `kind='report_added_to_bible'`, `link_to='/projects/{id}/bible'`.

Bell UI: add a `<NotificationBell />` next to the existing "Project Bible"
link in `src/routes/__root.tsx`. Small dot when unread > 0, click to open a
dropdown of the latest 10, each item links via `link_to`. Uses a 60-second
`useQuery` poll — no realtime yet, deliberate for scope.

## Print stylesheet

Append to `src/styles.css`:

```css
@media print {
  body > *:not([data-report-print-root]) { display: none !important; }
  [data-report-print-root] details { display: block !important; }
  [data-report-print-root] details > summary { list-style: none; }
  [data-report-print-root] { background: #fff; color: #000; }
}
```

The Report Viewer roots its scroll container with
`data-report-print-root` so Print never captures the app chrome.

## Files touched

New:
- `src/components/reports/ReportViewer.tsx`
- `src/components/reports/ReportSection.tsx`
- `src/components/reports/MarkdownReport.tsx`
- `src/components/notifications/NotificationBell.tsx`
- `src/lib/notifications.functions.ts`
- `src/lib/report-pdf.ts` (shared jsPDF renderer used by client + server fn)
- Migration for `notifications` + `project_bible_reports` tables (with GRANTs,
  RLS, policies).

Edited:
- `src/pages/Oracle.tsx` — swap the modal for `<ReportViewer>`.
- `src/routes/snags.new.tsx` + `src/routes/snags.$snagId.tsx` — wrap
  `ReportView` in `<ReportViewer>` and pass the snag's `project_id`.
- `src/routes/programme.$projectId.tsx` — wrap playbook results panel in
  `<ReportViewer>`.
- `src/lib/project-bible.functions.ts` — add `addReportToProjectBible`,
  extend `listProjectBibleDocuments` to include `project_bible_reports`.
- `src/routes/__root.tsx` — mount `<NotificationBell />` in the auth nav.
- `src/styles.css` — print stylesheet.

Deps added via `bun add`: `jspdf`, `html2canvas`.

## Out of scope (call out explicitly)

- Email/push notifications — only in-app bell for now.
- Realtime notification updates — polling every 60s.
- Custom PDF templating per report type — one shared A4 layout.
- Snag reports are org-scoped, not project-scoped; the Bible/notify flow
  attaches to their `snag_project_id` linked project. If a snag has no
  linked project, the "Add to Bible" button stays disabled with a tooltip.

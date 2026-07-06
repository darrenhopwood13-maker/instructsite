
## Goal

Standalone "Randall" tool: upload a construction programme (PDF/CSV), have AI translate every task into plain-English day-to-a-page entries, and give site managers a shared daily notes pad. Fully isolated from live checkouts.

## 1. Database (new migration)

**`programme_uploads`** — one row per uploaded programme
- `id`, `project_id` (FK projects), `file_name`, `mime_type`, `uploaded_by`, `created_at`

**`programme_reference_tasks`** — AI-extracted tasks
- `id`, `programme_upload_id`, `project_id`
- `task_name` (original), `plain_english` (AI-translated, present-tense "The team should be…")
- `start_date` (date), `end_date` (date), `allowed_days` (int, generated)
- `location`, `trade` (optional strings AI may infer), `created_at`

**`programme_manager_notes`** — global daily notes
- `id`, `project_id`, `note_date` (date), `author_id`, `author_name`, `body`, `created_at`, `updated_at`

RLS: project members read; project admins + site_manager role write. GRANT SELECT/INSERT/UPDATE/DELETE to `authenticated`, ALL to `service_role`. Realtime enabled on `programme_manager_notes`.

## 2. Server functions (`src/lib/randall.functions.ts`)

- `extractProgrammeWithRandall({ projectId, fileName, mimeType, dataBase64 })` — auth-gated (admin). Sends PDF/CSV to `google/gemini-2.5-pro` via Lovable AI Gateway with `Output.object` schema `{ tasks: [{ taskName, plainEnglish, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), location?, trade? }] }`. Prompt instructs plain-English translation of Gantt jargon. Inserts `programme_uploads` row, bulk-inserts tasks. Reuses the salvage/fallback pattern from `ai-extract-project.functions.ts`.
- `listProgrammeTasksForDate({ projectId, date })` — returns tasks where `start_date <= date <= end_date`, with `elapsedPct = (date - start + 1) / allowed_days * 100` computed server-side.
- `listManagerNotesForDate({ projectId, date })`, `upsertManagerNote({ projectId, date, body })`, `deleteManagerNote({ id })` — auth-gated.

## 3. Route & UI

New route `src/routes/randall.$projectId.tsx` under `_authenticated` layout. Dashboard link tile "Programme Reference Diary" added to the project page.

Page layout (uses existing shadcn tokens — Card, Button, Progress, Textarea, no hardcoded colors):

- **Header**: project name + "Upload Project Programme" button (admin only) → dialog with drop zone (PDF/CSV, 20MB cap) → calls `extractProgrammeWithRandall`, shows progress spinner.
- **Date navigator**: `< Previous Day | Today: 07 July 2026 | Next Day >` with a "Jump to today" button.
- **Today's tasks (read-only)**: list of cards, each showing plain-English description, original task name (muted), start–end dates, allowed days, and a `<Progress value={elapsedPct} />` bar with "Day X of Y · Z% elapsed". Empty state: "No programme tasks scheduled for this day."
- **Site Manager Global Notes**: single textarea + Save button that upserts one note per (project, date, author). Below it, list of all notes for that date from every manager with author name + timestamp. Subscribes to Supabase realtime channel on `programme_manager_notes` filtered by `project_id` and invalidates the query on INSERT/UPDATE/DELETE.

## 4. Styling

All components use existing shadcn primitives and semantic tokens (`bg-card`, `text-muted-foreground`, `border`, `text-primary`) — no hex values, no hardcoded Tailwind color utilities. Matches the current dark theme automatically.

## Out of scope

- No link to live checkouts, DABS pins, or QS verification (isolated tool as requested).
- No editing of extracted tasks (strictly read-only).
- No CSV export or re-run diff — a fresh upload creates a new `programme_uploads` row; UI queries the latest per project.

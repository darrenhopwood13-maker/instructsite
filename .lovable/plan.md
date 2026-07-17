## Subcontractor Pack — Frontend Build Plan

Backend is ready (`subcontractors`, `workers`, `registers`, `toolbox_talks`, `look_aheads` scoped by `project_id`, plus private `compliance-docs` bucket). This plan wires the UI on top, matching the existing InstructSite design (glass panels, Zen Dots headings, alert-orange accent, dark theme — same tokens used across `DropZone`, DABS, Subcontractor Cockpit).

### 1. Server functions — `src/lib/subcontractor-pack.functions.ts`
All functions use `requireSupabaseAuth` (RLS handles project scoping):
- `getSubcontractorPack({ projectId })` — returns `{ subcontractor, workers[], registers[], toolboxTalks[], lookAheads[] }`. Auto-creates/find a `subcontractors` row for the caller's company on this project (uses `getMyProjectContext` for company name).
- `getPackAggregate({ projectId })` — site-manager view; groups all subs on the project with counts and latest items.
- `addWorker`, `addRegister`, `addToolboxTalk`, `addLookAhead` — insert one row each, all with Zod validation.
- Signed-URL helper for competency card / certificate previews from `compliance-docs`.

### 2. Entry point buttons
- **DABS dashboard** (`src/routes/dabs.$projectId.tsx`): add a "Subcontractors Pack" button in the header action row → `Link to="/subcontractor-pack/$projectId"`.
- **Site Manager dashboard** (`src/routes/site-manager.$projectId.tsx`): add "Subcontractors Weekly Pack" button → `Link to="/subcontractor-pack/$projectId/manager"`.

### 3. New routes
```
src/routes/subcontractor-pack.$projectId.tsx           → Sub portal (Hub + Daily Log tabs)
src/routes/subcontractor-pack.$projectId.manager.tsx   → Site Manager aggregate view
```

**Sub portal layout:**
- Shared header: glass panel with company name (from `getMyProjectContext`), project name, back link.
- Top tab toggle (2 tabs, styled like existing segmented controls): **Hub** | **Daily Log**.
- Prominent orange "Submit Weekly Pack" button in header (UI only — disabled tooltip "PDF export coming next").

**Hub view (`SubHub` component)** — four glass-panel cards in a responsive grid:
1. Labour Roster — table: name, role, competency card link (opens signed URL).
2. Equipment Registers — grouped by type badge (PUWER/LOLER/HAVS/Plant), asset name, date.
3. Recent Toolbox Talks — last 5, topic + attendee count + date.
4. Current Look-Ahead — most recent row, work-plan text, red-outline chips if High Risk / Permit Required.

**Daily Log view (`SubDailyLog` component)** — accordion (shadcn `Accordion`) with four sections, each with its own Save button and success toast:
1. **Add Labour** — Name, Role, file input for competency card. On save: upload to `compliance-docs/{userId}/{projectId}/workers/{ts}-{filename}` then insert `workers` row with `competency_card_url` = storage path.
2. **Safety Register** — Type select (PUWER/LOLER/HAVS/Plant), Asset Name, Date picker, cert file upload → `compliance-docs/.../registers/...` → insert `registers`.
3. **Toolbox Talk** — Topic select (fixed list: Manual Handling, Working at Height, Slips/Trips, Fire Safety, Waste Segregation, Spill Control, Hot Weather, Confined Spaces, Hot Works, Excavations), attendees textarea (one per line → stored as `jsonb` array).
4. **Look-Ahead** — work plan textarea, two switches: High Risk, Permit Required.

Each section invalidates the `subcontractor-pack` query on success so Hub reflects new data instantly.

**Manager aggregate view** — glass table listing every subcontractor on the project with: company name, worker count, register count, latest toolbox talk date, latest look-ahead flags. Each row expands to show detail cards (same components as the Hub, read-only).

### 4. Design system compliance
- Reuse existing tokens only (`glass-panel`, `glass-accent`, `text-alert`, `border-white/10`, `bg-black/20`, `text-foreground`).
- Zen Dots for section headings, Inter Tight body — same as `DropZone`.
- shadcn `Accordion`, `Select`, `Switch`, `Input`, `Textarea`, `Button` (already in project).
- File uploads follow the `DropZone`/`compliance-docs` pattern: direct `supabase.storage.from("compliance-docs").upload(...)` from the browser after `ensureOracleSession`, then server-fn insert with the returned path.

### 5. Out of scope (deferred, per your note)
- PDF generation for "Submit Weekly Pack" — button renders but does nothing yet.
- Editing/deleting existing rows — insert-only for this pass.
- Notifications to PMs when a pack is submitted.

Ready to build once you approve.

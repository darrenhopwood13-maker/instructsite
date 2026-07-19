## Goal

Make DABS opt-in per drawing, and shift work-zone allocation to an Oracle step that runs when a drawing is added to DABS — not at project creation or blanket upload extraction.

## Current behaviour (verified)

- `project_drawings.in_dabs` defaults to `false`; `listDabsDrawings` already filters `in_dabs = true`. On this project 1 of 12 drawings is in DABS, so the filter works.
- The "Add to DABS" button lives inside `DrawingCanvas` (Project Drawings viewer) — easy to miss, and the same canvas is reused on the DABS page which makes the workflow confusing.
- Every drawing / logistics upload auto-extracts `work_zones` for the whole project regardless of whether it's ever added to DABS (`src/lib/tier1-uploads.functions.ts` lines ~176–230 and ~770–785). Result: the project accumulates zones from sheets that never enter DABS.
- The DABS pin form's "Work Zone / Level" dropdown pulls every `work_zones` row for the project, so those noise zones surface there.

## Changes

### 1. Stop auto-creating work zones on upload

In `src/lib/tier1-uploads.functions.ts`:

- In the drawing extraction path, keep extracting title-block metadata (drawing_no, revision, title, level, zone) but remove the `work_zones` upsert loop for `meta.zones`.
- In the logistics extraction path, still store `extracted_zones` JSON on `logistics_plans` (so Oracle can read it later), but remove the `work_zones` upsert loop.
- In the bulk "extractDrawingPack" path (~line 770), remove the `work_zones` upsert.

Net effect: uploads no longer populate `work_zones`. Only Oracle's Add-to-DABS step does.

### 2. New Oracle server function: allocate zones for a DABS drawing

Add `allocateZonesForDabsDrawing(drawingId)` in `src/lib/tier1-uploads.functions.ts` (auth + `is_project_admin` gate, same pattern as `setDrawingInDabs`):

- Fetch the drawing text (reuse `downloadDocText`) + any `logistics_plans.extracted_zones` for the project as context.
- Call the AI gateway with a prompt: "This drawing is now a live DABS work sheet. Identify the work zones / grid areas / levels a site manager would pin activities to. Return `{ zones: [{ name, level? }] }`. Do not invent zones — only what's shown on the sheet or corroborated by the logistics plan."
- Upsert results into `work_zones` with `source = 'oracle'` and a new column `drawing_id` (see §3) so zones are scoped to the drawing that produced them.
- Return `{ zones: [...] }` for a toast.

### 3. Migration: link zones to the drawing that produced them

- Add nullable `drawing_id uuid references public.project_drawings(id) on delete cascade` to `public.work_zones`.
- Optional: `source` already exists — no change.
- Backfill is not needed; existing zones stay project-scoped (drawing_id null).
- RLS: existing project-scoped policies continue to work; no new policy needed.

### 4. Wire allocation into "Add to DABS"

In `src/components/project/DrawingCanvas.tsx` `handleToggleDabs`:

- After `setDabsFn` resolves with `inDabs: true`, call the new `allocateZonesForDabsDrawing`.
- Toast: "Added to DABS · Oracle mapped N work zone(s)."
- On `inDabs: false`, no allocation call. (Zones with that drawing_id can stay; they were real. We do not auto-delete.)
- Invalidate `["zones", projectId]` so DABS/pin form refresh.

### 5. DABS-side polish (so the rule is obvious)

`src/routes/dabs.$projectId.tsx`:

- When `drawings.data` is empty, replace the drawing canvas with an empty-state card: "No drawings in DABS yet. Open Active Project Drawings, pick a sheet, and press 'Add to DABS'. Oracle will allocate the work zones automatically." Include a Link back to `/projects/$projectId`.
- Pass `hideInternalSelector` **is already false** — keep the selector, but the list is guaranteed filtered because it comes from `listDabsDrawings`.
- Optionally scope the Work Zone dropdown to zones tied to the currently-selected DABS drawing: `zones.filter(z => z.drawing_id === selectedDrawing || z.drawing_id === null)`. This keeps legacy zones visible but foregrounds the Oracle-allocated ones for this sheet.

### 6. Remove zone step from project creation flow

Confirm `src/routes/projects.new.tsx` does not seed `work_zones` directly (spot-check during implementation). If it does, delete that block — zones are now Oracle-driven.

## Files touched

- `src/lib/tier1-uploads.functions.ts` — remove auto-upserts, add `allocateZonesForDabsDrawing`.
- `src/components/project/DrawingCanvas.tsx` — call allocator after Add to DABS.
- `src/routes/dabs.$projectId.tsx` — empty state + optional zone scoping.
- `src/routes/projects.new.tsx` — remove any zone-creation step if present.
- Migration: `work_zones.drawing_id` FK.

## Out of scope

- No change to `listDabsDrawings` (already correct).
- No mass-clear of existing `work_zones` rows.
- No change to the pin-drop UI beyond the zone dropdown scoping.

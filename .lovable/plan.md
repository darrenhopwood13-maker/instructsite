## Goal

When a multi-page drawing pack is uploaded, every page currently appears in DABS. Give master/project admins a per-drawing "Add to DABS" toggle so only the sheets they curate become pin-drop targets in DABS.

## Changes

### 1. Schema (migration)
- Add `in_dabs BOOLEAN NOT NULL DEFAULT false` to `public.project_drawings`.
- Backfill: leave existing rows as `false` so admins deliberately opt each sheet in (avoids the current "every page floods DABS" problem). If preferred we can backfill `true` — will confirm before running.

### 2. Server functions (`src/lib/tier1-uploads.functions.ts`)
- `listProjectDrawings`: add `in_dabs` to the select.
- New `setDrawingInDabs({ drawingId, inDabs })` — `requireSupabaseAuth`, verifies caller is `is_project_admin(project_id, uid)` via the drawing's project, then updates `in_dabs`.
- New `listDabsDrawings({ projectId })` — same shape as `listProjectDrawings` but filtered `where in_dabs = true` and `is_active = true`.

### 3. Project page (`src/routes/projects.$projectId.tsx` + `DrawingCanvas.tsx`)
- In the Active Project Drawings list, add a small pill button "Add to DABS" / "In DABS ✓" (orange when active) next to each drawing row, visible only when `isAdmin`.
- Clicking calls `setDrawingInDabs` and invalidates the drawings query.

### 4. DABS route (`src/routes/dabs.$projectId.tsx`)
- Swap `listProjectDrawings` → `listDabsDrawings` so only opted-in sheets appear in the selector and canvas.
- Empty-state copy: "No drawings added to DABS yet. A project admin can enable sheets from the project page."

### 5. RLS
Existing `project_drawings` policies already gate by project membership; the new fn adds an admin check server-side. No policy changes needed.

## Out of scope
- Bulk "add all pages in pack" (can add later as a pack-level toggle).
- Subcontractor portal — unchanged.

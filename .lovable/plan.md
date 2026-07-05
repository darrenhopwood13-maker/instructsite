# Phase 5 · Real 3D IFC Viewer

Swap the text-chip `IfcMeshStatus` panel for a live Three.js canvas that loads an actual `.ifc` file, parses it in the browser, and recolours meshes from `daily_site_diaries` + `live_site_activity` state.

## 1 · Storage & schema (one migration + one bucket call)

**Bucket** — `project-bim-models`, **private** (IFC files are commercially sensitive; we serve them via short-lived signed URLs, not public links). If you specifically want it public I'll flip it, but private is the right default.

**Tables** (public schema, RLS + GRANTs):

- `project_ifc_models` — `id`, `project_id → projects(cascade)`, `storage_path text`, `original_filename text`, `uploaded_by → auth.users`, `is_active bool default true`, timestamps. Only one `is_active=true` per project (partial unique index).
- `ifc_element_mappings` — `id`, `model_id → project_ifc_models(cascade)`, `global_id text` (the IFC `GlobalId`), `zone_id → work_zones(cascade)`, unique `(model_id, global_id)`.

RLS: project members read; project admins insert/update/delete. `service_role` full.

## 2 · Libraries

Install:
- `web-ifc` — WASM IFC parser
- `three` + `@types/three`
- `@thatopen/components` + `@thatopen/fragments` — camera, grid, highlighter, IFC loader wrapper on top of `web-ifc`

Copy the `web-ifc` WASM into `public/wasm/` at install time so the viewer can point `IfcAPI.SetWasmPath("/wasm/")` — otherwise `web-ifc.wasm` 404s in production.

The viewer is client-only. Mounted with `<ClientOnly>` and dynamic import inside `useEffect`; no SSR pass.

## 3 · Server functions (`src/lib/ifc-models.functions.ts`)

- `listIfcModels({ projectId })` — member-scoped list.
- `getActiveIfcSignedUrl({ projectId })` — returns `{ url, model }` using `storage.createSignedUrl(path, 3600)`. Called from the viewer on mount.
- `uploadIfcModel` — accepts `{ projectId, storagePath, filename }` after client-side upload to `project-bim-models/{projectId}/{uuid}.ifc`; inserts row, sets it active, deactivates prior models. Admin-only.
- `listElementMappings({ projectId })` — returns `[{ global_id, zone_id }]` for the active model.
- `upsertElementMappings({ modelId, rows })` — admin bulk mapping upsert.
- `listZoneRuntimeState({ projectId })` — returns `[{ zone_id, state: 'unstarted' | 'live' | 'complete' }]` derived server-side:
  - `complete` if any `daily_site_diaries` row for that zone has `ifc_synced = true`
  - else `live` if a `live_site_activity` row with `status='active'` exists for that zone
  - else `unstarted`

## 4 · New components

### `src/components/project/BimModelViewer.tsx`
- Client-only. Sets up `THREE.Scene`, `PerspectiveCamera`, `OrbitControls` (rotate / pan / zoom), grid, ambient + directional light.
- Uses `@thatopen/components` `IfcLoader` to stream-parse the signed URL.
- After load, walks the fragments map keeping `globalId → THREE.Mesh[]` so we can recolour by GlobalId.
- Subscribes to a `useQuery(['zone-runtime', projectId], listZoneRuntimeState, { refetchInterval: 10_000 })` plus the existing realtime channel invalidation for `daily_site_diaries` and `live_site_activity`.
- Colour function per mesh:
  - `unstarted` → `#7a7a7a`, `transparent: true`, `opacity: 0.35`
  - `live` → `#ff7a00`, pulsing (emissive intensity oscillates in `requestAnimationFrame`)
  - `complete` → `#22c55e` solid
- Empty state: if no active model, render a dashed drop panel: **Upload .ifc model** (admin only).

### `src/components/project/BimModelUploader.tsx`
- Admin-only dropzone. Uploads to `project-bim-models` via `supabase.storage.from(...).upload()` with progress, then calls `uploadIfcModel`.

### `src/components/project/BimMappingEditor.tsx` (collapsible)
- Lists parsed GlobalIds from the loaded model with a zone `<Select>` per row. Save calls `upsertElementMappings`. Without mappings the viewer still renders but every mesh is grey — this editor is how the admin ties structure → zones.

## 5 · Site Manager wiring

`src/routes/site-manager.$projectId.tsx`:
- Delete the `<IfcMeshStatus />` block and the section around it.
- Insert `<ClientOnly><BimModelViewer projectId={projectId} /></ClientOnly>` in the same slot, full-width, min-height 520px, dark canvas that matches the panel aesthetic.
- Below it, collapsible **Model & Mapping** section with `<BimModelUploader />` + `<BimMappingEditor />` for admins only.

`IfcMeshStatus.tsx` is deleted.

## 6 · Realtime

`daily_site_diaries` and `live_site_activity` are already in the Site Manager realtime channel. Extend the existing subscription in `site-manager.$projectId.tsx` to also invalidate `['zone-runtime', projectId]` — the viewer re-queries and repaints without a manual refresh.

## 7 · Files touched

**New**
- `supabase/migrations/<ts>_ifc_models.sql`
- `src/lib/ifc-models.functions.ts`
- `src/components/project/BimModelViewer.tsx`
- `src/components/project/BimModelUploader.tsx`
- `src/components/project/BimMappingEditor.tsx`
- `public/wasm/web-ifc.wasm` (copied at install)

**Edited**
- `src/routes/site-manager.$projectId.tsx` (remove chips, mount viewer + admin tools, extend realtime invalidations)
- `package.json` (deps)

**Deleted**
- `src/components/project/IfcMeshStatus.tsx`

## 8 · Explicit non-goals

- No server-side IFC parsing. Parsing runs in the browser with the WASM binary; the server only serves the file and mappings.
- No automatic GlobalId → zone inference. The `BimMappingEditor` is manual for now (later phase can add naming-convention heuristics).
- No IFC diff/versioning UI. Uploading a new model marks it active and older rows go inactive; historical mappings stay tied to their model_id.

## 9 · Two things I need you to confirm before I ship

1. **Bucket privacy** — I'm defaulting `project-bim-models` to **private** with signed URLs. The brief said "public"; confirm you actually want public (anyone with the URL can download the IFC) or accept private.
2. **First mapping** — once the viewer is live, meshes stay grey until you (or an admin) fill in `ifc_element_mappings`. That's the manual step. OK to ship the editor and let you map post-upload, rather than blocking on an auto-mapper?

Approve and I'll ship the migration first, then the viewer.

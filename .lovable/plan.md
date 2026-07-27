## Group B — file-by-file root cause and fix plan

### B1 — Document register has no lifecycle controls

**Files responsible**
- `src/routes/projects.$projectId.tsx` (drawings/logistics/RAMS lists rendered inline, no per-row actions)
- `src/components/setup/DropZone.tsx` (upload path — no dedupe warning)
- `src/lib/tier1-uploads.functions.ts` (list + create functions; no `archived_at`, no supersede, no hash lookup)
- `site_documents` / `project_drawings` / `logistics_plans` / `rams_documents` tables (no soft-delete or revision columns)

**Fix**
1. Migration: add `archived_at timestamptz`, `archived_by uuid`, `superseded_by uuid`, `revision_of uuid`, `content_hash text` to `site_documents`; index `(project_id, content_hash)`. Update RLS select policies to hide archived rows by default; add an "include archived" server flag.
2. `tier1-uploads.functions.ts`: new server fns `archiveSiteDocument`, `restoreSiteDocument`, `supersedeSiteDocument` (marks old row archived + `superseded_by` = new id, new row `revision_of` = old id), `retagRamsDocument({ tradePackage, highRiskFlags })`, and `checkDuplicateUpload({ projectId, fileName, contentHash })`. `listProjectDrawings/Logistics/Rams` already exclude archived via the new RLS.
3. `DropZone.tsx`: hash file client-side (SHA-256 via `crypto.subtle`), call `checkDuplicateUpload` before upload; if a match exists show a modal — "Replace as new revision" (supersedes) vs "Upload as separate document" vs "Cancel".
4. `projects.$projectId.tsx`: per row, add a small action strip (View · Re-tag · New revision · Archive). Archive prompts a confirm dialog. Drawings list deduplicates by `content_hash || file_name` before render so the 12-row noise collapses.

---

### B2 — RAMS trade tagging broken

**Files responsible**
- `src/routes/projects.$projectId.tsx` lines 346-449 (`UnifiedRamsBlock`) — free-text `trade` state + hazard chips with independent `flags` state that never merges into the trade name; `DropZone` receives them separately, so if the user never types the trade the row saves as `"General"`.
- `src/components/admin/TradeDirectoryPanel.tsx` — Trade Packages counter reads `subcontractors` table, which stays empty until an invite is accepted (see Group A A5).

**Fix**
1. Add server fn `listProjectTradePackages(projectId)` that returns distinct trades from `subcontractor_invites.trade_packages[]` unioned with `subcontractors`.
2. Replace the free-text input in `UnifiedRamsBlock` with a `<select>` populated from that fn, plus an "Other…" option that reveals the text input.
3. Wire hazard chips: they already toggle `flags` — extend `extraFields` so hazards persist as `high_risk_flags`. Add client-side validation: upload button disabled until `trade !== ""` (and not "General" unless explicitly typed). Show inline error "Select a trade before uploading."
4. `TradeDirectoryPanel`: swap the count source to `listProjectTradePackages` so `(0)` reflects real data.

---

### B3 — Project Bible search is filename-only + IFC missing

**Files responsible**
- `src/routes/projects_.$projectId.bible.tsx` lines 52-62 — filter only checks `title` and `fileName`
- `src/lib/project-bible.functions.ts` — enumerates drawings/logistics/rams/programme/report but not `project_ifc_models`; no full-text search
- `document_contents` table already stores extracted text — currently unused by the Bible

**Fix**
1. Extend `listProjectBibleDocuments` to also emit `{ source: "model", category: "Models" }` rows from `project_ifc_models` (link to signed URL, no extraction).
2. New server fn `searchProjectBible({ projectId, q })` that runs `to_tsquery` against `document_contents.content` joined to `site_documents`, returning `{ documentId, snippet }[]`.
3. Migration: add a GIN index `document_contents_content_tsv_idx` on `to_tsvector('english', content)`.
4. `projects_.$projectId.bible.tsx`: when `query.length >= 3`, fire a debounced `useQuery` against `searchProjectBible`, merge matching document IDs into the filtered set, and render the snippet under the card.

---

### B4 — IFC viewer + auto-allocator

**Files responsible**
- `src/components/project/BimModelViewer.tsx` lines 380+ — camera position never fits the loaded model's bounding box; no reset control
- `src/components/project/BimMappingEditor.tsx` (`runRandallAutoAllocate`) and `src/lib/ifc-models.functions.ts` `autoAllocateModelElements` — matches only on concatenated text, `roof`/`slab` ordering means an IfcSlab named "roof-slab" hits the `concrete` pattern first and is put into the substructure zone; also returns after first match with no fallback per element and reports no confidence/unmapped

**Fix**
1. `BimModelViewer.tsx`: after `loadIfcMeshes` returns its `box`, compute `sphere = box.getBoundingSphere()`, position the camera at `center + normalize(offset) * (radius / sin(fov/2))`, set `controls.target = center`. Add a "Reset View" button in the toolbar that re-invokes this fit function.
2. `ifc-models.functions.ts` `autoAllocateModelElements`:
   - Change input shape to `{ globalId, text, ifcType }` and pass `ifcType` through from `BimMappingEditor.scanModel` (already tracked).
   - Add hard-typed rules first: `IfcSlab + /roof|ridge|eaves/i.test(name)` → roof zone; `IfcSlab` otherwise → concrete/substructure; `IfcRoof` → roof always; `IfcBeam|IfcColumn` → structural steel; `IfcWindow/Door` → windows/doors.
   - Score every pattern rather than first-match; pick highest-scoring pattern that has a matching zone; return a `confidence` per row (`hard` | `strong` | `weak`).
   - Return `{ count, unmapped, confidence: { hard, strong, weak }, perElement: [{ globalId, zoneId | null, confidence }] }`.
3. `BimMappingEditor.tsx`: render a summary row after allocation — `X mapped · Y unmapped · Z low-confidence`, and shade rows in the table by confidence so the user can spot the shaky ones.

---

### B5 — Excessive/duplicate network traffic on `/site-manager/{projectId}`

**Files responsible**
- `src/components/project/BimModelViewer.tsx` `loadIfcMeshes` — every mount re-`fetch`es the signed IFC URL and re-`import("web-ifc")` initialises a fresh WASM instance
- `src/components/project/BimMappingEditor.tsx` `scanModel` — a second independent WASM init + IFC download
- `src/routes/site-manager.$projectId.tsx` — many `useQuery` calls with no `staleTime`, `refetchInterval` of 5–8s, and the BIM panel mounts eagerly so its downloads happen even when collapsed
- `public/wasm/*` served with Vite's default (no long-lived cache header)

**Fix**
1. Create `src/lib/ifc-cache.ts`: module-level cached `Promise<IfcAPI>` (single WASM init) + `caches.open("ifc-blobs")` / IndexedDB fallback keyed on `modelId+updatedAt`; `getIfcBuffer(modelId, signedUrl)` returns the cached `Uint8Array`. Use it in both `BimModelViewer` and `BimMappingEditor`.
2. Add a small server route `src/routes/api/public/ifc/$modelId.ts` that streams the file with `Cache-Control: public, max-age=31536000, immutable` and validates the caller's Supabase token via query-string signature (or just reuses the existing signed URL host); simplest path: keep the Supabase signed URL but add a response-header override via storage transform options.
3. Consolidate the two `live-pins` queries into one keyed `["live-pins-all", projectId]` and derive the sheet-filtered view client-side (removes half the duplicate GETs).
4. Wrap the BIM panel + QS queue + Archived Today in `<details>` accordions with `enabled: opened` on their queries so collapsed sections never fetch.
5. Add `staleTime: 30_000` (or 60_000 for zones/drawings) to every read query on the page.
6. `vite.config.ts`: add a small `headers` middleware that sets `Cache-Control: public, max-age=31536000, immutable` for `/wasm/*` in dev; production Worker headers already cover this once we serve wasm via the caching route.

---

### B6 — Small fixes

**Files responsible**
- No `src/routes/organisation.*` file — `/organisation` 404s.
- `src/routes/__root.tsx` line 117 — `apple-touch-icon` points at `favicon.ico`; iOS ignores `.ico` for that rel and requests `/apple-touch-icon.png` from the root.
- `src/routes/dabs.$projectId.tsx` — no `pendingComponent` and drawings/zones/roles all gated on `ready` but the outer JSX renders nothing while `ready === false`.

**Fix**
1. Add `src/routes/organisation.tsx` (and `organisation.$rest.tsx` splat) that throws `redirect({ to: "/org" })` in `beforeLoad`.
2. Generate a 180×180 PNG at `public/apple-touch-icon.png` (from the existing brand mark) and update `__root.tsx` to point `rel="apple-touch-icon"` at it.
3. `dabs.$projectId.tsx`: render a skeleton (drawing list placeholder + canvas shimmer) immediately, gated on `!ready || drawings.isLoading`, so the board never shows an empty white frame.

---

### Technical notes

- Every new server fn goes in an existing `*.functions.ts` (no new server directory) and re-uses `requireSupabaseAuth`.
- Soft-delete migration uses `archived_at IS NULL` filters inside existing RLS SELECT policies; no policy is dropped.
- Full-text index uses expression index on `to_tsvector('english', content)` — no generated column needed.
- IFC caching keeps Supabase signed URLs (no SSRF surface); the in-memory cache is per-tab so it doesn't affect multi-tenant isolation.
- No publish/deploy — you'll trigger that yourself.

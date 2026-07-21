## Tooling cockpit — cinematic redesign

Scope: visual only, on `/tooling`. No changes to Oracle logic, streaming, prompts or routes.

### 1. Cinematic image-backed action buttons
`src/components/tooling/ActionGrid.tsx` — replace the flat glass tiles with hyper-realistic cinematic image tiles, one image per action:

| # | Action | Image concept (generated, `standard` quality) |
|---|---|---|
| 01 | Installation Sequence | timber-frame soleplate at dawn, taut string line, blueprint overlay |
| 02 | Safety Auditor | high-vis helmet + harness on scaffold edge, low sun |
| 03 | Procurement | luxury stone slabs in bonded warehouse, forklift bokeh |
| 04 | Drawing Q&A | architect's hand on a set of A1 drawings, drafting lamp |
| 05 | Snag Master | macro of a hairline defect on plaster, torchlight raking |
| 06 | Ask The Oracle | Mayfair townhouse at blue hour, glowing site cabin |

Tile structure:
- Full-bleed image background, 16:10-ish aspect on mobile, taller on md.
- Dark cinematic gradient overlay (bottom-heavy) for legibility.
- Corner code chip (`01`–`06`), icon badge, title + sub in the design system's `--foreground` on gradient.
- Hover: subtle zoom + brightness lift, primary ring on focus.
- Loading: image dims, spinner overlay, `● RUN` chip.

### 2. Orange buttons upgraded to match the rest of the app
`ScanUpload.tsx` — the Scan / Upload / View / Remove buttons currently use raw `bg-alert` (orange). Swap them to the same shadcn `Button` component and variants used elsewhere in the app (`variant="default"` primary, `variant="secondary"` and `variant="outline"` for secondary actions), so they match Snags / DABS / Subcontractor Pack.

Also add a third capture path:
- **Scan** — existing camera input (kept).
- **Capture** — new dedicated capture-image button using `getUserMedia` to open a lightweight in-page camera modal, snap → return dataURL, close. Falls back to the camera file input on unsupported browsers.
- **Upload** — existing file picker.
- **View** — existing viewer link.

All four use the same button component and match the app's primary/secondary styling. No raw `bg-alert` on this page.

### 3. Readable text boxes
`PromptInput.tsx` and the file-name row in `ScanUpload.tsx` — currently `bg-transparent` / `bg-white/5`, which disappears against the mesh background. Change to a solid, readable surface using existing tokens:
- Card wrapper: `bg-card` with `border-border`, subtle inner shadow.
- Textarea: `bg-background` (or `bg-input`), `text-foreground`, `placeholder:text-muted-foreground`.
- File-name / status pill: `bg-secondary` with `text-secondary-foreground`.

Same treatment applied consistently so every input sits on an opaque surface.

### 4. Terminal panel polish (light touch)
`ToolingTerminal.tsx` — nudge the panel background to `bg-card/95` with `backdrop-blur` so streaming output is high-contrast against the mesh backdrop. No structural changes.

### Files touched
- `src/components/tooling/ActionGrid.tsx` — cinematic tiles.
- `src/components/tooling/ScanUpload.tsx` — Button component, add Capture, drop raw orange.
- `src/components/tooling/PromptInput.tsx` — solid surface + readable text.
- `src/components/tooling/ToolingTerminal.tsx` — opaque panel.
- `src/assets/tooling/*.jpg` — 6 new cinematic images (generated once at `standard` quality, imported as ES6 assets).
- (New) `src/components/tooling/CaptureCameraDialog.tsx` — in-page camera capture modal.

### Out of scope
- Oracle prompts, streaming route, viewer, markdown renderer.
- Any other page.
- Auth / RLS / server functions.
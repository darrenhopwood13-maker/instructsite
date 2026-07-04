## Goal

Make the PDF/image drawing viewer (`src/components/project/DrawingCanvas.tsx` → `InlinePreview`) behave like a proper CAD/PDF viewer: mouse-wheel zoom anchored on cursor, click-and-drag pan, and crisp, readable text at any zoom level. This is the only drawing viewer in the app (used by DABS and Site Manager pages), so upgrading it covers "all PDF drawing viewers".

## Changes (single file: `src/components/project/DrawingCanvas.tsx`)

### 1. Pan/zoom interaction model

Replace the current `overflow-auto` scroll container + `zoom` state with a transform-based viewport:

- New state: `scale` (number, default = fit) and `offset` `{x, y}` (pan, in CSS px).
- Wrap `<canvas>` + `<PinOverlay>` in an inner div with
  `transform: translate(${offset.x}px, ${offset.y}px) scale(${scale/fitScale})`
  and `transform-origin: 0 0`. Outer container is `overflow-hidden`, `cursor-grab` / `cursor-grabbing`.
- Wheel handler: `e.preventDefault()`, compute new scale (`* 1.1` per notch, clamp 0.1–12), and adjust `offset` so the point under the cursor stays fixed (standard anchored-zoom math using `getBoundingClientRect`).
- Mouse handlers: `onMouseDown` starts drag (record start offset + client point), `onMouseMove` updates offset, `onMouseUp` / `onMouseLeave` ends it. Drag is disabled while `pinMode === "drop"` so pin drop still works; in that mode wheel still zooms.
- Double-click resets to fit (offset 0, scale = fit).
- Buttons (Zoom in/out/Fit) reuse the same handlers.

### 2. High-quality rendering

Current code renders PDF at `fitScale * zoom * dpr` but caps `dpr` at 2 and re-renders every zoom step, which is slow and can still look blurry when zoomed. New approach:

- Render the PDF page once at a **high base resolution** (`fitScale * qualityMultiplier * dpr`, where `qualityMultiplier = 2` and `dpr` uncapped up to 3), producing a sharp bitmap large enough to zoom into ~2× without pixelation.
- Apply user zoom via CSS transform (fast, no re-render).
- When user zooms past the rendered resolution (`scale > renderedScale * 1.25`), debounce (~250 ms after wheel stops) and re-render the PDF page at the new scale, capped so the canvas pixel area stays below ~40 MP to avoid browser limits. Same treatment for images: re-draw the `ImageBitmap` into the canvas at the higher scale.
- Keep the white background fill and the existing render-cancellation logic.

### 3. Pin overlay

Pins are positioned by `%` inside the same transformed inner div, so they pan/zoom with the drawing automatically. Pin size stays visually constant by applying `transform: scale(${1/(scale/fitScale)})` to each pin marker, so markers don't grow huge at high zoom.

Pin drop coordinates: compute `xPct`/`yPct` against the canvas's own bounding rect (already what the code does) — still correct because the canvas is the transformed element.

### 4. UI hints

- Toolbar gains a small hint: "Scroll to zoom · Drag to pan · Double-click to fit".
- `cursor-grab` on the viewport, `cursor-grabbing` while dragging, `cursor-crosshair` in pin-drop mode (unchanged behaviour).

## Technical notes

- No new dependencies; `pdfjs-dist` already used.
- Only `src/components/project/DrawingCanvas.tsx` is edited. No server, RLS, or route changes.
- Pin drop math stays as percentages of the canvas element, so DABS pin persistence is unaffected.

## Verification

- Open a drawing on `/dabs/:projectId` and `/site-manager/:projectId`: scroll-wheel zoom anchors on cursor; drag pans; text remains sharp at 200–400% zoom; double-click fits.
- In pin-drop mode, clicks still drop pins at the correct percentage; wheel-zoom still works.
- Existing pins render at the correct spatial location before/after zoom, and stay a constant visual size.

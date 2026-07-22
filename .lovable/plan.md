
## Problem

On `/tooling`, the Scan/Upload buttons only accept `accept="image/*"`, so PDFs are silently rejected. The Oracle streaming endpoint only forwards `image_url` content — it has no path for PDF text. The `/viewer` route only renders images. So dropping a PDF (drawing, spec, RAMS) does nothing.

## Fix

### 1. Accept PDFs in `ScanUpload`
- Change the Upload input's `accept` to `application/pdf,image/*` (Scan/camera stays image-only — phones can't "capture" a PDF).
- Extend `onImage` callback signature to pass a `kind: "image" | "pdf"` plus the raw file bytes (as base64) for PDFs, so the server can parse them. Images stay as `data:` URLs (unchanged).
- Guard file size (~15 MB) with a toast; larger PDFs won't fit through the gateway.

### 2. Preview inside `ToolingTerminal`
- Images: unchanged (existing `<img>` preview).
- PDFs: render a compact preview card — filename, page count once known, and a small inline viewer using an `<iframe>` on the object URL for the current browser tab (works on desktop; on mobile Safari shows the built-in PDF pill — that's the best inline behaviour without pulling in a heavy dep).
- Keep the existing Remove (×) affordance.

### 3. Full PDF viewer at `/viewer`
- Extend `/viewer` to detect PDFs (via a new `is-viewer-kind` sessionStorage flag) and render them with `react-pdf` (built on `pdfjs-dist`), giving pinch-zoom, page nav, and text-selection — the most suitable parser+viewer combo in the React ecosystem and already the parser we use server-side (`unpdf` wraps the same pdf.js).
- Install `react-pdf` (adds `pdfjs-dist` as a peer). Worker loaded from the bundled asset URL so it works inside the Cloudflare Worker preview.

### 4. Parse PDF text server-side and feed it to The Oracle
- In `src/routes/api/oracle-stream.ts`, accept a new optional `pdfBase64` + `pdfFileName` on the request body.
- When present, decode to `Uint8Array` and run `unpdf`'s `extractText` (already used in `document-contents.functions.ts` and Worker-safe) with `mergePages: true`.
- Truncate to ~40k chars to stay within the model context, then inject as a `text` block in the user message:
  ```
  [Attached PDF: <fileName>, <pageCount> pages]
  <extracted text…>
  ```
- Image attachments continue to be sent as `image_url` as today; a request may include either or both.
- If extraction returns empty (image-only / scanned PDF), send back a `warning` field the client shows as a toast: "This PDF has no selectable text — export a text-based PDF or attach as an image."

### 5. Wire the new field through `tooling.tsx`
- `ToolingPage` gains `pdfBase64` / `pdfFileName` state alongside `imageDataUrl`.
- `runOracle` sends both fields to `/api/oracle-stream`.
- The Snag Master guard stays image-only (photos of defects don't come as PDFs).

## Files touched

- `src/components/tooling/ScanUpload.tsx` — accept PDFs, emit kind + payload.
- `src/components/tooling/ToolingTerminal.tsx` — preview PDF card + iframe.
- `src/routes/tooling.tsx` — new state, forward PDF to API.
- `src/routes/api/oracle-stream.ts` — decode + `unpdf` extract + inject into prompt.
- `src/routes/viewer.tsx` — react-pdf branch for PDFs.
- `package.json` — add `react-pdf`.

## Out of scope

- OCR for scanned/image-only PDFs (would need Gemini vision pass — call out in the toast; can add later if you want it).
- Persisting the PDF to the Project Bible from this cockpit (existing "Add to Project Bible" flow on report output stays as-is).

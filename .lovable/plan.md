# Standalone AI Tooling — port from instruct-Site (Fellowship cockpit)

Replace the current project-locked `/oracle` tooling with the single-page cockpit pattern from the **instruct-Site** project. One page, one shared photo + prompt, one 6-button action grid that streams markdown into a terminal panel — no project lock, no locked-drawing context, no ReportViewer chrome.

Visual style stays 100% in this project's current look (dark aurora, `glass-panel`, `text-alert` accents, Zen Dots headings). The cyan/amber Fellowship palette from the source project is **not** carried over.

## Persona (unchanged)

Every button reuses the full Oracle system prompt already in `src/lib/oracle.functions.ts` — 30-year senior site manager + 15 years HSE + fellowships (FCIOB, FRICS, FICE, FRIBA, FIStructE, FBIID, FENSA, NICEIC), professional senior-consultant tone, cite the relevant body inline, never hedge on safety. Each button appends a per-function focus line (Installation Sequence, Safety Auditor, Procurement, Drawing Q&A, Snag Master, AI Assist).

## The cockpit — `/tooling`

One route, top-to-bottom:

1. **Terminal panel** — title bar with activity indicator, active-function chip, `Copy` / `Clear`. Empty state greeting. Streaming state shows a 4-step progress rail (Reading → Analysing → Generating → Finalising) with a thin progress bar; probes `/promo.mp4` (HEAD) and loops it beside the rail if it exists, hides otherwise. Result state renders markdown via `react-markdown` + `remark-gfm`.

2. **Two-column input row**
   - `ScanUpload`: Take Photo (camera) + Upload + View (opens `/viewer`, see below) + preview thumbnail with remove.
   - `PromptInput`: single textarea for the user's question / context.

3. **Action grid** — 6 tiles (2-col mobile / 3-col desktop):
   `installation_sequence`, `safety_auditor`, `procurement`, `drawing_qa`, `snag_master` (requires a photo — toast if missing), `ai_assist` (small "PRO" accent). Only the active tile spins; others disabled during a run.

## Installation Sequence — special result rendering

Ported from the old chat. Applies **only** when the active function is `installation_sequence`:

- The Oracle is instructed to structure output with `##` section headings; each `##` block becomes a **collapsible panel** (click to expand/collapse, default collapsed except **BY OTHERS**).
- A dedicated **BY OTHERS** section is required, with each line formatted `**TRADE** — what — when — consequence`. The renderer parses those lines and shows each one as an individual boxed card (alert-accent border, hard-hat icon, trade name as the heading, the rest as detail).
- Other functions render as plain streamed markdown.

Implementation lives in `ToolingResults.tsx`, which switches on `activeFunction` and either parses `##` blocks + `BY OTHERS` lines, or passes through to `react-markdown`.

## Image viewer — `/viewer`

Full-screen route ported from the old chat. Reads the image data URL + name from `sessionStorage` (`is-viewer-image`, `is-viewer-name`) set by `ScanUpload`'s View button/thumbnail click.

Features:
- Pan (drag) + pinch/wheel zoom on a canvas.
- Mark-up tools: brush with 5 colour swatches, brush-size slider, Undo, Clear.
- Share (uses `navigator.share` with the marked-up file on mobile, falls back to Download).
- Download (composites canvas + markup into a PNG).
- Back button returns to `/tooling` with the original photo state intact.

## Backend — streaming server route

`src/routes/api/oracle-stream.ts` — TanStack server route (streaming SSE, not `createServerFn`). POST body:

```
{ buttonFunction: FunctionKey, base64Image?: string, userQuestion?: string }
```

Handler:
- Read `LOVABLE_API_KEY` inside the handler.
- Model: `google/gemini-3.6-flash` (multimodal, current gen).
- System prompt = the existing full Oracle persona + per-function focus. For `installation_sequence`, append the formatting contract (`## headings`, mandatory `## BY OTHERS` with `**TRADE** — what — when — consequence` lines).
- Messages: text + `image_url` block when a photo was sent.
- Direct `fetch` to `https://ai.gateway.lovable.dev/v1/chat/completions` with `stream: true` and `Lovable-API-Key` header; forward the SSE body verbatim (matches the source project's parser).
- Non-OK: return JSON `{ error }` with upstream status; client already handles 402 / 429 toasts.

No auth middleware — cockpit works signed-out.

## Files

Add:
- `src/routes/tooling.tsx` — the cockpit page (adapted from instruct-Site `Index.tsx`, no i18n, no react-router-dom).
- `src/routes/viewer.tsx` — image viewer + mark-up tools.
- `src/routes/api/oracle-stream.ts` — streaming server route.
- `src/components/tooling/ToolingTerminal.tsx` — port of `OracleTerminal`, restyled with current tokens (`glass-panel`, `text-alert`, `text-foreground`, Zen Dots).
- `src/components/tooling/ScanUpload.tsx` — port, uses `useNavigate` from `@tanstack/react-router` (not react-router-dom).
- `src/components/tooling/PromptInput.tsx`.
- `src/components/tooling/ActionGrid.tsx` — 6 tiles, English strings inlined, cyan/amber → alert/foreground/accent tokens.
- `src/components/tooling/ToolingResults.tsx` — markdown renderer + Installation-Sequence collapsibles + BY OTHERS trade cards.

Edit:
- `src/components/OracleFAB.tsx` — link → `/tooling`, hide on `/tooling`, add `/oracle` to defensive hide list during migration.

Remove:
- `src/routes/oracle.tsx`
- `src/pages/Oracle.tsx`

Untouched:
- `src/lib/oracle.functions.ts` — persona strings copied into the new streaming handler; `runOracleCommand` / `askProjectOracle` / `oracleScan` stay for existing callers (e.g. `ensureOracleSession`, mobile subcontractor Oracle).
- Snag Master project module, Project Bible, ReportViewer — all unchanged.

## Explicit non-goals

- No i18n / language switcher.
- No `ai_runs` persistence — v1 is stateless.
- No colour-scheme changes — current project tokens only.
- No schema / RLS / migrations.
- Site Scan tile from current Oracle is folded into Snag Master.

## Verification

- `/tooling` loads signed-in and signed-out; no project prompt.
- Snag Master with photo + prompt → markdown streams, step rail advances.
- Safety Auditor with prompt only → streams a response.
- Snag Master with no photo → toast, no request fired.
- Installation Sequence → `##` sections render as expand/collapse panels; `## BY OTHERS` renders as boxed trade cards with the parsed **TRADE** heading.
- View button in `ScanUpload` opens `/viewer`; mark-up + Share + Download all work; Back preserves cockpit state.
- Copy button copies the completed response; Clear resets output.
- FAB targets `/tooling` (not `/oracle`); old `/oracle` URL is gone.
- 402 / 429 responses surface as the correct toast.

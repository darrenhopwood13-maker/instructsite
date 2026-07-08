# Randall Programme Compiler — Rebuild For Good

## What's actually wrong

Checked the AI Gateway logs. The most recent compile call:
`google/gemini-2.5-pro`, 12,887 output tokens, **101,430 ms**.

That is the smoking gun. The gateway responded successfully, but 101 s is past the practical Worker execution budget for a single server function — the client's `fetch` to `/_serverFn/...` gets torn down before the handler finishes writing rows, so the UI reports "no output generated" / stuck / doesn't work even though the model actually replied. Combine that with:

- One giant `generateText` call trying to do **task extraction + every daily summary** in one JSON blob, which is why output is 13 k tokens.
- `Output.object({ schema })` on `openai-compatible` + Gemini is **not** strict-schema enforced (see `ai-sdk-lovable-gateway`) — schema drift is silently possible, and only caught by the salvage path.
- PDF/CSV passed as an AI SDK `file` part through the openai-compatible transport to Gemini is fragile; CSVs in particular go in as base64 and the model wastes a chunk of its budget just decoding them.
- One-shot design means the user waits 100 s staring at a spinner and, if it fails at any point, gets nothing.

## Fix strategy — split the job, keep it deterministic where possible

Rework `compileProgrammePlaybooks` into a short, fast **extraction-only** AI call, then build the day-to-a-page playbook deterministically from the extracted tasks. This is the "explore every conceivable way" answer: we stop asking the model to do the part it's bad at (writing 300 daily paragraphs) and only ask it to do the part it's good at (reading a Gantt and returning tasks).

### 1. Server-side pre-parse before touching AI

`src/lib/programme.functions.ts`:

- **CSV path (fully deterministic, no AI):** parse the CSV in Node, auto-detect columns (`task`/`name`/`activity`, `start`/`start date`, `end`/`finish`/`end date`, optional `trade`, `location`, `zone`). Support common formats (Asta, MSP CSV export, Primavera CSV, plain Excel-saved CSV). If we get ≥1 valid task, **skip the AI entirely**.
- **PDF path:** extract text with `unpdf` (Worker-safe, pure JS, no native bindings). Truncate to ~120 k characters of raw text and pass **only the text** to the AI, not the base64 PDF. This roughly halves input tokens and removes the openai-compatible `file`-part fragility.
- Add `bun add unpdf papaparse` and `@types/papaparse`.

### 2. AI call: extraction only, chunked, structured

- Model: `google/gemini-2.5-pro` (already correct — big context, strong at tabular reading).
- Provider built with `{ structuredOutputs: true }` via a shared helper in `ai-gateway.server.ts` for OpenAI-family models; for Gemini we keep `Output.object` but also **wrap the call** in `NoObjectGeneratedError.isInstance` + `salvageFromText` (already present, kept and hardened).
- **Schema shrinks** to only what's needed: `{ projectStart, projectEnd, tasks: [{ taskName, startDate, endDate, trade, location }] }`. No more `dailySummaries`, no more `plainEnglish` from the model. This drops output size from ~13 k tokens to ~1–2 k, which brings the call under ~20 s.
- If the extracted-text length > ~80 k chars, split into overlapping chunks and run **N extraction calls in parallel** (`Promise.all`), merge + de-dupe tasks by `(taskName, startDate)`.
- `maxOutputTokens: 8192` per chunk is now plenty.

### 3. Playbook generation without AI

Replace the "AI writes every daily summary" path with a richer deterministic writer:

- For each date in `[projectStart, projectEnd]` (capped at 400 days):
  - list active tasks with `Day X of Y`
  - group by trade
  - mark **starts today** / **ends today**
  - flag overlapping trades in the same location
  - roll up a one-line headline ("Heavy day — 4 trades active in Zone B")
- Zero AI cost, zero latency, always succeeds, and reads exactly like the current `buildDeterministicSummary` — just more detail.
- Optional: keep an AI "polish this day" server fn (`polishPlaybookDay`) the UI can call **on demand** for a single date the user is reading — cheap, fast, and never blocks the initial compile.

### 4. Make the compile fit the Worker budget

- Split the server function into two phases exposed to the UI:
  1. `extractProgrammeTasks` — uploads file, runs pre-parse + AI extraction, returns `{ uploadId, taskCount, firstDate, lastDate }`. This is the only call that touches the model; target < 30 s.
  2. `generatePlaybookDays` — takes `uploadId`, writes `daily_programme_playbooks` rows in batches of 100 with `upsert`. Pure DB work, fast.
- The UI (`programme.$projectId.tsx`) chains them: shows "Reading programme…" then "Building playbook…" with a real progress indicator, instead of one 100 s spinner.

### 5. Better failure surfacing

- If pre-parse yields 0 tasks *and* AI yields 0 tasks, throw a specific error the UI shows verbatim: "Randall couldn't find any dated tasks. Expected a CSV/PDF with task name + start + end date columns."
- Wrap the AI call in a 45 s `AbortController` timeout so we fail fast instead of dangling.
- Log `console.info` at each phase boundary so `supabase--edge_function_logs` / server-function logs actually show where a run stopped.

## Technical notes (files touched)

- `src/lib/programme.functions.ts` — split into `extractProgrammeTasks` + `generatePlaybookDays` + `polishPlaybookDay`; add CSV parser, PDF text extractor, chunked AI extraction, richer deterministic writer, abort timeout.
- `src/lib/ai-gateway.server.ts` — accept a `{ structuredOutputs?: boolean }` option so the OpenAI-family path is strict; Gemini path unchanged.
- `src/routes/programme.$projectId.tsx` — two-step compile mutation with phase labels; keep the existing UI shell.
- `package.json` — add `unpdf`, `papaparse`, `@types/papaparse`.
- No DB migration required — reuses `programme_uploads`, `programme_reference_tasks`, `daily_programme_playbooks`.

## Out of scope

- No changes to `programme_manager_notes` / notes UI.
- No changes to subscription gating on Randall.
- No new routes.

Confirm and I'll build it.

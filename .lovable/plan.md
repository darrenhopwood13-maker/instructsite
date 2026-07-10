## What's actually going on

You're right to be annoyed. The app already has a Gemini PDF vision path built in — it lives in `src/lib/programme-compiler.server.ts` (`aiExtractFromPdf`) and calls `google/gemini-2.5-flash` through the Lovable AI Gateway, passing the raw PDF as a file part. That's the "Gemini done it in 10 seconds" path.

On top of that, we *also* built a whole second parser — the `render-parser/` FastAPI service — which:

- Runs on Render (separate deploy, separate secret, cold-start ~30s on free tier)
- Uses `pdf2image` + `poppler` to rasterise the PDF to PNGs
- Sends each PNG to **OpenAI gpt-4o** (needs an `OPENAI_API_KEY` you'd have to pay for separately)
- Returns tasks that then go through the same DB writes

The server function tries Render first (if `PROGRAMME_PARSER_URL` is set) and only falls back to Gemini if Render fails. So if you set that env var, you're paying OpenAI + Render to do a worse, slower version of what Gemini already does for free through Lovable Cloud.

If `PROGRAMME_PARSER_URL` isn't set, the Render service isn't being used at all — Gemini is already doing the work. Which is almost certainly what happened in your 10-second test.

## Plan

1. **Delete the Render parser entirely** — `render-parser/` folder (Dockerfile, main.py, render.yaml, requirements.txt, README.md).
2. **Remove the Render branch in `src/lib/programme.functions.ts`** — strip the `PROGRAMME_PARSER_URL` / `PROGRAMME_PARSER_SECRET` fetch block (~50 lines) and always call `compileProgrammeFile` directly. Keep everything else (upload record, job record, task/playbook writes, progress updates) unchanged.
3. **Tune the Gemini path so it wins on the first try** — in `aiExtractFromPdf`:
   - Bump `maxOutputTokens` from 8192 → 16384 so large programmes don't get truncated.
   - Tighten the prompt: state that dates must be inferred from the chart's date axis, skip summary/milestone rows, and return `{tasks: []}` when the page isn't a programme.
   - Optionally switch to `google/gemini-2.5-pro` for PDFs over a size threshold — more accurate on dense Gantts, still one call.
4. **Keep the deterministic pre-passes** (CSV/XER/XML/text-based PDF extract via unpdf). Those are free and instant when the file is text-based — no reason to touch them.
5. **Leave `PROGRAMME_PARSER_URL` / `PROGRAMME_PARSER_SECRET` behind as unused secrets** — no code reads them anymore, and you can delete them from the dashboard whenever.

## What this changes for you

- No Render account, no Docker service, no `OPENAI_API_KEY`, no `PARSER_SECRET`.
- One code path: deterministic parse → Gemini PDF vision fallback.
- Uses Lovable AI credits only (already provisioned via `LOVABLE_API_KEY`).
- Same DB shape, same UI, same realtime job progress.

## Not doing (unless you ask)

- Changing the DB schema or the playbook builder.
- Touching the upload UI or the realtime job status component.
- Adding a new model provider or new secrets.

Shall I go ahead and rip the Render parser out and tune the Gemini call?
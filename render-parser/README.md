# Randall Programme Parser (Render service)

Standalone FastAPI service that reads a Gantt-chart PDF and returns a task list. The Lovable app (`src/lib/programme.functions.ts`) calls this service when `PROGRAMME_PARSER_URL` is set, and falls back to the inline parser if it fails.

## Endpoint

`POST /`
- `multipart/form-data`: `file`, `fileName`, `mimeType`
- Header: `x-parser-secret: <PARSER_SECRET>`
- 200 → `{ "source": "pdf-vision", "tasks": [{ taskName, startDate, endDate, trade?, location? }] }`
- Non-200 → JSON error; Lovable app falls back safely.

`GET /` → health JSON.

## Deploy to Render

1. Push this folder to a Git repo (or use this repo and set the root dir to `render-parser`).
2. Render → **New** → **Blueprint** → point at the repo. `render.yaml` provisions a Docker web service.
3. In the service **Environment** tab, set:
   - `PARSER_SECRET` — same value as `PROGRAMME_PARSER_SECRET` in Lovable. Generate with `openssl rand -hex 32`.
   - `OPENAI_API_KEY` — your OpenAI key (`sk-...`).
4. Deploy. Copy the live URL, then in Lovable set:
   - `PROGRAMME_PARSER_URL` = `https://<your-service>.onrender.com/`
   - `PROGRAMME_PARSER_SECRET` = same as `PARSER_SECRET` above.

## Local test

```bash
docker build -t randall-parser .
docker run -p 8000:8000 \
  -e PARSER_SECRET=dev \
  -e OPENAI_API_KEY=sk-... \
  randall-parser

curl -X POST http://localhost:8000/ \
  -H "x-parser-secret: dev" \
  -F "fileName=test.pdf" \
  -F "mimeType=application/pdf" \
  -F "file=@/path/to/programme.pdf"
```

## Notes

- CSV / XML / XER return 415 on purpose — the Lovable inline parser is already deterministic for those formats.
- Free Render instances sleep after 15 min; first request after idle may take ~30 s to wake. Use Starter+ for production.
- Vision cost is per page; `MAX_PAGES` caps at 12 by default.

## Scaffold the Render PDF Parser Service

I'll create a standalone Python service you can deploy to Render. It lives in a new folder `render-parser/` inside your project so you can push it to a separate Git repo (or point Render at that subdirectory).

### What gets created

```text
render-parser/
├── main.py              FastAPI app with POST / endpoint
├── requirements.txt     fastapi, uvicorn, pdf2image, pillow, openai, python-multipart
├── Dockerfile           python:3.11-slim + poppler-utils (needed by pdf2image)
├── render.yaml          One-click Render blueprint (web service, env vars)
└── README.md            Deploy steps + how to test locally
```

### How `main.py` will work

1. `POST /` accepts `multipart/form-data` with `file`, `fileName`, `mimeType`.
2. Auth: compares `x-parser-secret` header against `PARSER_SECRET` env var (rejects with 401 if mismatch).
3. If `mimeType` is PDF:
   - Rasterise pages with `pdf2image` (uses poppler from the Docker image) at ~200 DPI.
   - Send each page image to OpenAI `gpt-4o` with a strict JSON-schema prompt asking for `{ tasks: [{ taskName, startDate, endDate, trade?, location? }] }` where dates are `YYYY-MM-DD`.
   - Merge tasks across pages, de-dupe by `(taskName, startDate)`.
4. If `mimeType` is CSV / XML / XER: return 415 so your app's inline parser handles it (it already does those well).
5. Response: `{ "source": "pdf-vision", "tasks": [...] }` — matches the contract `programme.functions.ts` already expects.
6. Errors return JSON `{ error, detail }` with a non-200 status so the Lovable app falls back to inline parsing cleanly.

### Env vars the service reads

| Name | Purpose |
|---|---|
| `PARSER_SECRET` | Must equal `PROGRAMME_PARSER_SECRET` you saved in Lovable |
| `OPENAI_API_KEY` | For GPT-4o vision |
| `PORT` | Provided by Render automatically |

### Deploy flow (what you'll do after I scaffold)

1. Push `render-parser/` to GitHub (new repo or a subdir of this one).
2. In Render → New → Blueprint → point at the repo. `render.yaml` provisions the web service.
3. Set `PARSER_SECRET` and `OPENAI_API_KEY` in Render's env var UI.
4. Copy the live URL (e.g. `https://randall-parser.onrender.com`) into Lovable's `PROGRAMME_PARSER_URL` secret.
5. Upload a Gantt PDF in the app — `programme.functions.ts` will hit Render first, get real tasks back, and write them to `daily_programme_playbooks`.

### What I will NOT change

- No edits to `src/lib/programme.functions.ts` — the client contract is already correct from the previous turn.
- No changes to database schema or existing app code.
- No secret values set — you'll paste `OPENAI_API_KEY` into Render yourself.

Approve and I'll create the four files.

# Randall Programme Parser

External Python microservice that ingests construction programme PDFs (Asta / P6 exports, tabular PDFs, plus CSV/XML/XER) and returns a normalised task list for InstructSite.

Runs as a **fire-and-forget worker**:

1. InstructSite uploads the file to Supabase Storage and creates a
   `programme_jobs` row.
2. InstructSite POSTs `{ job_id, signed_url, callback_url }` to this
   service's `POST /parse`. The service returns `202` immediately and
   processes in the background.
3. When done, the service POSTs the parsed tasks to
   `callback_url` (an InstructSite `/api/public/hooks/programme-ingest`
   route) signed with `X-Signature` HMAC-SHA256 using `PROGRAMME_PARSER_SECRET`.

## Environment variables (set on Render / Railway)

| Name | Purpose |
| --- | --- |
| `PROGRAMME_PARSER_SECRET` | HMAC shared secret. Must match the value in Lovable Cloud. |
| `AI_API_KEY` | Lovable AI Gateway key (`LOVABLE_API_KEY` in Lovable). Enables Gemini vision fallback for visual Gantt PDFs. Optional but strongly recommended. |
| `AI_BASE_URL` | Defaults to `https://ai.gateway.lovable.dev/v1`. |
| `AI_VISION_MODEL` | Defaults to `google/gemini-2.5-flash`. |

## Deploy to Render (free tier is fine for MVP)

1. Create a new **Web Service** on Render.
2. Point it at this directory (or push to a GitHub repo and connect it).
3. Environment: **Docker**. Render will detect `Dockerfile`.
4. Add the env vars above.
5. Deploy. Copy the resulting `https://<your-service>.onrender.com` URL.
6. In Lovable, save that URL as the `PROGRAMME_PARSER_URL` secret.

## Local test

```bash
docker build -t programme-parser .
docker run --rm -p 8000:8000 \
  -e PROGRAMME_PARSER_SECRET=dev-secret \
  -e AI_API_KEY=$LOVABLE_API_KEY \
  programme-parser
curl http://localhost:8000/health
```

## Parsing strategy (in order)

1. **CSV / TSV** — `csv` module with header detection.
2. **P6 XER** — tab-separated table parser.
3. **MS Project / P6 XML** — XML task extraction.
4. **PDF tables (`pdfplumber`)** — column detection with fuzzy header
   matching (task / start / finish / trade / zone).
5. **PDF free text** — regex scan for date pairs on the same line.
6. **PDF vision fallback** — rasterise pages with `pdf2image` and send
   to Gemini via the Lovable AI Gateway for visual Gantt-bar reading.
   Only runs when the deterministic passes yield zero tasks.

The final task list is deduped, date-normalised (ISO `YYYY-MM-DD`),
trade-inferred, and zone-matched with `rapidfuzz` before callback.

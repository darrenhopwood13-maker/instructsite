
# Randall Diary — Async Pipeline with Python Sidecar

Rebuild the programme → day-to-a-page compiler as an **async job queue** backed by an **external Python microservice** that specialises in visual Gantt PDFs (Asta / P6 exports).

## Architecture

```text
Browser ──upload──▶ TanStack serverFn ──▶ Supabase Storage (programme_uploads bucket)
                          │
                          ├── inserts programme_jobs row (status='queued')
                          └── POSTs {job_id, file_url} to Python service (fire-and-forget)

Python FastAPI worker (Render / Railway)
   1. downloads PDF via signed URL
   2. multi-strategy extraction:
        • pdfplumber → tables/text
        • Camelot → lattice/stream tables
        • pdf2image + Gemini Vision → visual Gantt bar OCR
        • fuzzy bay/zone matcher (rapidfuzz)
   3. emits normalised task rows (task, start, finish, zone, dep, trade)
   4. calls back POST /api/public/hooks/programme-ingest with HMAC signature
        → writes tasks + generates day-to-a-page playbooks + marks job 'complete'

Browser ─── Supabase realtime on programme_jobs ─── live progress + result
```

## Deliverables

### 1. Database (migration)
- `programme_jobs` table: `id`, `project_id`, `upload_id`, `status` (queued/parsing/writing/complete/failed), `strategy` (text|vision|table|hybrid), `progress` (0–100), `error`, `stats` jsonb, timestamps.
- GRANT + RLS: project members read own jobs; service_role full.
- Enable realtime on the table.

### 2. Python microservice (`services/programme-parser/`)
- FastAPI app, Dockerfile, `requirements.txt`.
- Endpoints:
  - `POST /parse` — accepts `{job_id, signed_url, callback_url}`, returns 202 immediately, processes in background task.
  - `GET /health`.
- Libraries: `pdfplumber`, `camelot-py[cv]`, `pdf2image`, `pillow`, `rapidfuzz`, `pydantic`, `google-generativeai` (Gemini vision for Gantt-bar reading), `httpx`.
- HMAC-signs the callback with `PROGRAMME_PARSER_SECRET`.
- Deploy target: Render (free tier ok for MVP) or Railway. User owns the hosting account.

### 3. TanStack side
- `src/lib/programme.functions.ts` — replace `compileProgrammePlaybooks` with:
  - `enqueueProgrammeJob({ uploadId })` — creates job row, signs storage URL (1h), POSTs to `PROGRAMME_PARSER_URL` with `PROGRAMME_PARSER_SECRET`.
  - `getProgrammeJob(jobId)` — read status.
- `src/routes/api/public/hooks/programme-ingest.ts` — HMAC-verified callback. Writes `programme_reference_tasks`, generates `daily_programme_playbooks` deterministically (existing `buildProgrammePlaybookRows` logic moves here), updates job.
- `src/routes/programme.$projectId.tsx` — replace synchronous button with:
  - Upload → enqueue → subscribe to job row via Supabase realtime.
  - Progress bar, per-stage status ("Extracting tables… Reading Gantt bars… Writing 142 tasks…"), clear failure surface.

### 4. Secrets to add
- `PROGRAMME_PARSER_URL` — https URL of deployed Python service.
- `PROGRAMME_PARSER_SECRET` — HMAC shared secret (generated).
- `GEMINI_API_KEY` inside the Python service env (uses same Lovable AI gateway or direct — configured on Render, not in this app).

## Rollout order

1. Migration + realtime enabled.
2. Ship the Python service repo (I'll write it in full — you deploy to Render, paste the URL back).
3. Wire the TanStack side + callback route behind the two secrets.
4. Remove the old inline `compileProgrammePlaybooks` AI path once end-to-end verified on Grafton PDF.

## Not in scope this pass

- XER/MPP native parsing (add after visual-PDF path is proven).
- Auto email-ingestion pipeline.
- Fuzzy-matching UI for reviewing unresolved bays (data captured in `stats.unresolved`, reviewed later).

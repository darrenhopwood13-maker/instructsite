"""
Randall Programme Parser — Render-deployed PDF vision service.

Contract (matches src/lib/programme.functions.ts):
  POST /
    multipart/form-data: file, fileName, mimeType
    header: x-parser-secret  (must equal env PARSER_SECRET)
  200 -> { "source": "pdf-vision", "tasks": [ {taskName, startDate, endDate, trade?, location?}, ... ] }
  4xx/5xx -> { "error": "...", "detail": "..." }   (Lovable app falls back to inline parser)
"""
from __future__ import annotations

import base64
import io
import json
import os
from typing import Any

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from openai import OpenAI
from pdf2image import convert_from_bytes

app = FastAPI(title="Randall Programme Parser")

PARSER_SECRET = os.environ.get("PARSER_SECRET", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o")
MAX_PAGES = int(os.environ.get("MAX_PAGES", "12"))
DPI = int(os.environ.get("PDF_DPI", "200"))

client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

SYSTEM_PROMPT = (
    "You extract construction programme (Gantt chart) tasks from a page image. "
    "Return STRICT JSON only, matching this schema exactly: "
    '{"tasks":[{"taskName":string,"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD",'
    '"trade":string|null,"location":string|null}]}. '
    "Rules: (1) Dates MUST be ISO YYYY-MM-DD; infer year from the chart's date axis. "
    "(2) taskName is the row label as printed. (3) If a bar's start or end cannot be "
    "determined confidently, omit that task. (4) Skip summary/header rows and milestones "
    "with zero duration unless they have a clear date. (5) trade/location only if visibly "
    "labelled in a column; otherwise null. Return {\"tasks\":[]} if none found. No prose."
)


def _extract_json(text: str) -> dict[str, Any]:
    """Best-effort: strip code fences, parse JSON."""
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        # remove leading language tag like 'json\n'
        nl = t.find("\n")
        if nl != -1:
            t = t[nl + 1 :]
        if t.endswith("```"):
            t = t[:-3]
    try:
        return json.loads(t)
    except Exception:
        # find first { .. last }
        i, j = t.find("{"), t.rfind("}")
        if i != -1 and j != -1 and j > i:
            return json.loads(t[i : j + 1])
        raise


def _parse_page(png_bytes: bytes, page_num: int) -> list[dict[str, Any]]:
    assert client is not None
    b64 = base64.b64encode(png_bytes).decode("ascii")
    resp = client.chat.completions.create(
        model=MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Programme page {page_num}. Extract tasks."},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"},
                    },
                ],
            },
        ],
    )
    content = resp.choices[0].message.content or "{}"
    data = _extract_json(content)
    tasks = data.get("tasks", [])
    return tasks if isinstance(tasks, list) else []


def _clean(tasks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, str]] = set()
    out: list[dict[str, Any]] = []
    for t in tasks:
        if not isinstance(t, dict):
            continue
        name = (t.get("taskName") or "").strip()
        start = (t.get("startDate") or "").strip()
        end = (t.get("endDate") or start).strip()
        if not name or not start:
            continue
        key = (name.lower(), start)
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "taskName": name,
                "startDate": start,
                "endDate": end,
                "trade": t.get("trade") or None,
                "location": t.get("location") or None,
            }
        )
    return out


@app.get("/")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "service": "randall-programme-parser",
        "model": MODEL,
        "openai_configured": bool(OPENAI_API_KEY),
        "secret_configured": bool(PARSER_SECRET),
    }


@app.post("/")
async def parse(
    file: UploadFile = File(...),
    fileName: str = Form(""),
    mimeType: str = Form(""),
    x_parser_secret: str | None = Header(default=None, alias="x-parser-secret"),
):
    if PARSER_SECRET and x_parser_secret != PARSER_SECRET:
        raise HTTPException(status_code=401, detail="invalid parser secret")
    if client is None:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    mt = (mimeType or file.content_type or "").lower()
    name = (fileName or file.filename or "").lower()
    is_pdf = "pdf" in mt or name.endswith(".pdf")
    if not is_pdf:
        # Let the app's inline parser handle CSV / XML / XER — they're deterministic.
        return JSONResponse(
            status_code=415,
            content={"error": "unsupported", "detail": f"parser handles PDF only, got {mt or 'unknown'}"},
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty file")

    try:
        images = convert_from_bytes(raw, dpi=DPI, fmt="png")
    except Exception as e:
        return JSONResponse(
            status_code=422,
            content={"error": "rasterise_failed", "detail": str(e)},
        )

    images = images[:MAX_PAGES]
    all_tasks: list[dict[str, Any]] = []
    errors: list[str] = []
    for idx, img in enumerate(images, start=1):
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        try:
            all_tasks.extend(_parse_page(buf.getvalue(), idx))
        except Exception as e:
            errors.append(f"page {idx}: {e}")

    tasks = _clean(all_tasks)
    if not tasks:
        return JSONResponse(
            status_code=422,
            content={
                "error": "no_tasks_extracted",
                "detail": "; ".join(errors) or "vision model returned no tasks",
            },
        )

    return {"source": "pdf-vision", "tasks": tasks}

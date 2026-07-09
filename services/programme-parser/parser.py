"""Multi-strategy construction programme parser.

Pipeline:
  1. Detect file kind by MIME + extension.
  2. Deterministic parsers: CSV, XER, XML, PDF tables (pdfplumber), PDF free text.
  3. Vision fallback: rasterise PDF pages with pdf2image and send to Gemini
     via the Lovable AI Gateway when the deterministic pipeline finds nothing.
  4. Normalise dates, infer trades, fuzzy-match locations.
"""
from __future__ import annotations

import base64
import csv
import io
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable

import httpx
from dateutil import parser as dateparser
from pydantic import BaseModel
from rapidfuzz import fuzz

logger = logging.getLogger("programme-parser.parser")

AI_BASE_URL = os.environ.get("AI_BASE_URL", "https://ai.gateway.lovable.dev/v1")
AI_API_KEY = os.environ.get("AI_API_KEY", "")
AI_VISION_MODEL = os.environ.get("AI_VISION_MODEL", "google/gemini-2.5-flash")

MAX_VISION_PAGES = 12


# ------------------- Models -------------------

class Task(BaseModel):
    task_name: str
    start_date: str  # ISO YYYY-MM-DD
    end_date: str
    trade: str = ""
    location: str = ""


@dataclass
class ParseOutcome:
    tasks: list[Task]
    strategy: str
    stats: dict[str, Any]


# ------------------- Dates / normalisation -------------------

ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def to_iso(s: str) -> str:
    if not s:
        return ""
    s = str(s).strip()
    if not s:
        return ""
    if ISO_RE.match(s[:10]):
        return s[:10]
    try:
        dt = dateparser.parse(s, dayfirst=True, fuzzy=True)
        return dt.date().isoformat()
    except (ValueError, TypeError, OverflowError):
        return ""


TRADE_KEYWORDS: list[tuple[str, list[str]]] = [
    ("Groundworks", ["ground", "excavat", "drain", "duct", "foundation", "slab", "piling", "substructure"]),
    ("Concrete", ["concrete", "pour", "formwork", "rebar", "rc frame"]),
    ("Steelwork", ["steel", "frame", "beam", "column", "decking"]),
    ("Envelope", ["roof", "clad", "curtain", "window", "facade", "façade", "brick", "brass"]),
    ("MEP", ["mep", "mechanical", "electrical", "plumb", "hvac", "sprinkler", "containment", "commission"]),
    ("Drylining", ["drylin", "partition", "plasterboard", "ceiling", "skim"]),
    ("Fit-out", ["fit out", "fit-out", "joinery", "floor finish", "decorate", "paint", "tiling", "snag", "repatination"]),
    ("External", ["external", "landscap", "paving", "kerb", "car park"]),
]


def infer_trade(name: str) -> str:
    n = name.lower()
    for label, keys in TRADE_KEYWORDS:
        if any(k in n for k in keys):
            return label
    return "General"


LOC_RE = re.compile(
    r"\b(?:block|zone|area|level|lvl|floor|plot|phase|core|stair|bay)\s*[A-Z0-9][A-Z0-9\-/.]*",
    re.IGNORECASE,
)


def infer_location(name: str) -> str:
    m = LOC_RE.search(name)
    return m.group(0).strip() if m else ""


def clean_name(raw: str) -> str:
    r = re.sub(r"\b(?:start|finish|end|duration|dur|baseline|early|late|planned|actual)\b", " ", raw, flags=re.I)
    r = re.sub(r"\b\d+(?:\.\d+)?\s*(?:d|day|days|w|wk|week|weeks|hrs?|hours?)\b", " ", r, flags=re.I)
    r = re.sub(r"\b\d{1,3}%\b", " ", r)
    r = re.sub(r"^[\s\d.#\-\u2013\u2014_:|/\\]+", "", r)
    return re.sub(r"\s{2,}", " ", r).strip()


def _valid(t: Task) -> bool:
    if len(t.task_name) < 3:
        return False
    if not ISO_RE.match(t.start_date) or not ISO_RE.match(t.end_date):
        return False
    if t.start_date < "1990-01-01" or t.start_date > "2100-01-01":
        return False
    return True


def normalise(raw: dict[str, str]) -> Task | None:
    start = to_iso(raw.get("start", ""))
    end = to_iso(raw.get("end", ""))
    name = clean_name(raw.get("name", ""))
    if not name or not start:
        return None
    if end and end < start:
        end = start
    if not end:
        end = start
    trade = (raw.get("trade") or infer_trade(name)).strip()
    loc = (raw.get("location") or infer_location(name)).strip()
    t = Task(task_name=name, start_date=start, end_date=end, trade=trade, location=loc)
    return t if _valid(t) else None


def merge(rows: Iterable[dict[str, str]]) -> list[Task]:
    seen: dict[str, Task] = {}
    for r in rows:
        t = normalise(r)
        if not t:
            continue
        key = f"{t.task_name.lower()}|{t.start_date}|{t.end_date}"
        seen.setdefault(key, t)
    result = list(seen.values())
    result.sort(key=lambda x: x.start_date)
    return result


# ------------------- Fuzzy zone canonicalisation -------------------

def canonicalise_locations(tasks: list[Task]) -> list[Task]:
    if not tasks:
        return tasks
    seen: list[str] = []
    for t in tasks:
        loc = t.location.strip()
        if not loc:
            continue
        match = next((s for s in seen if fuzz.token_set_ratio(loc, s) >= 88), None)
        if match:
            t.location = match
        else:
            seen.append(loc)
    return tasks


# ------------------- CSV -------------------

NAME_KEYS = ["task", "task name", "activity", "activity name", "name", "description", "work", "operation"]
START_KEYS = ["start", "start date", "begin", "planned start", "baseline start", "early start"]
END_KEYS = ["end", "end date", "finish", "finish date", "planned finish", "baseline finish", "early finish", "completion"]
TRADE_KEYS = ["trade", "discipline", "contractor", "subcontractor", "resource"]
LOC_KEYS = ["location", "zone", "area", "level", "floor", "wbs", "phase", "block", "bay"]


def _pick(row: dict[str, str], candidates: list[str]) -> str | None:
    keys = list(row.keys())
    for c in candidates:
        for k in keys:
            if k.strip().lower() == c:
                return k
    for c in candidates:
        for k in keys:
            if c in k.strip().lower():
                return k
    return None


def parse_csv_bytes(data: bytes) -> list[Task]:
    text = data.decode("utf-8", errors="replace")
    # Try comma then tab
    for delim in (",", "\t", ";"):
        try:
            reader = csv.DictReader(io.StringIO(text), delimiter=delim)
            rows = [r for r in reader if any((v or "").strip() for v in r.values())]
        except csv.Error:
            continue
        if not rows:
            continue
        first = rows[0]
        n, s, e = _pick(first, NAME_KEYS), _pick(first, START_KEYS), _pick(first, END_KEYS)
        if not (n and s and e):
            continue
        tk = _pick(first, TRADE_KEYS)
        lk = _pick(first, LOC_KEYS)
        parsed = merge({
            "name": (r.get(n) or "").strip(),
            "start": (r.get(s) or "").strip(),
            "end": (r.get(e) or "").strip(),
            "trade": (r.get(tk) or "").strip() if tk else "",
            "location": (r.get(lk) or "").strip() if lk else "",
        } for r in rows)
        if parsed:
            return parsed
    return []


# ------------------- XER -------------------

def parse_xer_bytes(data: bytes) -> list[Task]:
    text = data.decode("utf-8", errors="replace")
    if "%T" not in text or "TASK" not in text:
        return []
    table = ""
    fields: list[str] = []
    rows: list[dict[str, str]] = []
    for line in text.splitlines():
        parts = line.split("\t")
        if parts[0] == "%T":
            table = parts[1] if len(parts) > 1 else ""
            fields = []
        elif parts[0] == "%F" and table == "TASK":
            fields = parts[1:]
        elif parts[0] == "%R" and table == "TASK" and fields:
            record = dict(zip(fields, parts[1:] + [""] * len(fields)))
            name = record.get("task_name") or record.get("task_code") or record.get("task_id") or ""
            start = record.get("start_date") or record.get("early_start_date") or record.get("target_start_date") or record.get("act_start_date") or ""
            end = record.get("end_date") or record.get("early_end_date") or record.get("target_end_date") or record.get("act_end_date") or ""
            if name and start and end:
                rows.append({"name": name, "start": start, "end": end, "trade": "", "location": ""})
    return merge(rows)


# ------------------- XML (MS Project / P6) -------------------

def parse_xml_bytes(data: bytes) -> list[Task]:
    text = data.decode("utf-8", errors="replace")
    if "<Task" not in text:
        return []
    tasks: list[dict[str, str]] = []
    for m in re.finditer(r"<Task[>\s][\s\S]*?</Task>", text):
        block = m.group(0)
        if re.search(r"<Summary>\s*1\s*</Summary>", block):
            continue

        def _tag(name: str) -> str:
            g = re.search(rf"<{name}[^>]*>([\s\S]*?)</{name}>", block, re.I)
            if not g:
                return ""
            return re.sub(r"<!\[CDATA\[|\]\]>", "", g.group(1)).strip()

        name = _tag("Name")
        start = _tag("Start") or _tag("BaselineStart")
        end = _tag("Finish") or _tag("BaselineFinish")
        if name and start and end:
            tasks.append({"name": name, "start": start, "end": end, "trade": "", "location": ""})
    return merge(tasks)


# ------------------- PDF (pdfplumber) -------------------

def parse_pdf_tables(data: bytes) -> tuple[list[Task], str]:
    import pdfplumber

    all_rows: list[dict[str, str]] = []
    full_text_pages: list[str] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            full_text_pages.append(page.extract_text() or "")
            for tbl in page.extract_tables() or []:
                if not tbl or len(tbl) < 2:
                    continue
                header = [(c or "").strip() for c in tbl[0]]
                if not any(header):
                    continue
                header_map = {i: h.lower() for i, h in enumerate(header)}
                name_idx = _column_for(header_map, NAME_KEYS)
                start_idx = _column_for(header_map, START_KEYS)
                end_idx = _column_for(header_map, END_KEYS)
                if name_idx is None or start_idx is None or end_idx is None:
                    continue
                trade_idx = _column_for(header_map, TRADE_KEYS)
                loc_idx = _column_for(header_map, LOC_KEYS)
                for row in tbl[1:]:
                    if not row:
                        continue
                    def _cell(i: int | None) -> str:
                        if i is None or i >= len(row):
                            return ""
                        return (row[i] or "").strip()
                    all_rows.append({
                        "name": _cell(name_idx),
                        "start": _cell(start_idx),
                        "end": _cell(end_idx),
                        "trade": _cell(trade_idx),
                        "location": _cell(loc_idx),
                    })

    tasks = merge(all_rows)
    if tasks:
        return tasks, "pdf-table"
    # Fallback: free-text date pair scan
    joined = "\n".join(full_text_pages)
    return _parse_free_text(joined), "pdf-text"


def _column_for(header_map: dict[int, str], candidates: list[str]) -> int | None:
    for c in candidates:
        for i, h in header_map.items():
            if h == c:
                return i
    for c in candidates:
        for i, h in header_map.items():
            if c in h:
                return i
    return None


DATE_RE = re.compile(
    r"(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|"
    r"\d{1,2}[\s\-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[A-Za-z]*[\s\-,]+\d{2,4}|"
    r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[A-Za-z]*[\s\-]+\d{1,2}[\s\-,]+\d{2,4})",
    re.IGNORECASE,
)


def _parse_free_text(text: str) -> list[Task]:
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in text.splitlines() if ln.strip()]
    lines = [ln for ln in lines if not re.match(r"^page\s+\d+", ln, re.I)]
    tasks: list[dict[str, str]] = []
    for i, line in enumerate(lines):
        for span in range(1, 4):
            combined = " ".join(lines[i:i + span])
            matches = list(DATE_RE.finditer(combined))
            isos = [(m.group(0), to_iso(m.group(0)), m.start()) for m in matches]
            isos = [x for x in isos if x[1]]
            if len(isos) < 2:
                continue
            first = isos[0]
            last = isos[-1]
            before = clean_name(combined[: first[2]])
            after = clean_name(combined[last[2] + len(last[0]):])
            candidate = max([c for c in (before, after) if len(c) >= 3], key=len, default="")
            if not candidate or re.match(r"^(start|finish|end|duration|date)$", candidate, re.I):
                continue
            tasks.append({
                "name": candidate,
                "start": first[1],
                "end": last[1],
                "trade": "",
                "location": "",
            })
            break
    return merge(tasks)


# ------------------- Vision fallback -------------------

def vision_extract(data: bytes) -> list[Task]:
    if not AI_API_KEY:
        logger.warning("AI_API_KEY not set; skipping vision fallback")
        return []
    try:
        from pdf2image import convert_from_bytes
    except ImportError:
        logger.warning("pdf2image not installed; skipping vision fallback")
        return []

    try:
        images = convert_from_bytes(data, dpi=140, fmt="jpeg")
    except Exception:  # noqa: BLE001
        logger.exception("pdf2image failed")
        return []

    images = images[:MAX_VISION_PAGES]
    logger.info("vision fallback: %d pages", len(images))

    content: list[dict[str, Any]] = [{
        "type": "text",
        "text": (
            "You are Randall, an expert construction planner. Extract every activity "
            "from this construction programme PDF (Gantt chart or task list). "
            "Return STRICT JSON of the form "
            "{\"tasks\":[{\"task_name\":str,\"start_date\":\"YYYY-MM-DD\",\"end_date\":\"YYYY-MM-DD\","
            "\"trade\":str,\"location\":str}]}. "
            "Read visual Gantt bars for start/finish dates by aligning them to the header timeline. "
            "Skip project summaries and roll-up rows. Use ISO dates."
        ),
    }]
    for img in images:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
        })

    body = {
        "model": AI_VISION_MODEL,
        "messages": [{"role": "user", "content": content}],
        "response_format": {"type": "json_object"},
        "temperature": 0.1,
    }

    try:
        with httpx.Client(timeout=180) as client:
            r = client.post(
                f"{AI_BASE_URL}/chat/completions",
                json=body,
                headers={
                    "authorization": f"Bearer {AI_API_KEY}",
                    "content-type": "application/json",
                },
            )
            r.raise_for_status()
            payload = r.json()
    except Exception:  # noqa: BLE001
        logger.exception("vision AI call failed")
        return []

    txt = ""
    try:
        txt = payload["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, TypeError):
        logger.warning("vision AI returned unexpected shape: %s", payload)
        return []

    import json as _json
    try:
        # Strip markdown fencing if any
        cleaned = re.sub(r"^```(?:json)?|```$", "", txt.strip(), flags=re.MULTILINE).strip()
        parsed = _json.loads(cleaned)
    except _json.JSONDecodeError:
        logger.warning("vision AI JSON decode failed")
        return []

    raw = parsed.get("tasks") if isinstance(parsed, dict) else parsed
    if not isinstance(raw, list):
        return []
    rows = [{
        "name": str(t.get("task_name") or t.get("name") or ""),
        "start": str(t.get("start_date") or t.get("start") or ""),
        "end": str(t.get("end_date") or t.get("end") or ""),
        "trade": str(t.get("trade") or ""),
        "location": str(t.get("location") or t.get("zone") or ""),
    } for t in raw if isinstance(t, dict)]
    return merge(rows)


# ------------------- Entry point -------------------

def parse_programme(*, data: bytes, file_name: str, mime_type: str) -> ParseOutcome:
    started = datetime.utcnow()
    name = file_name.lower()
    stats: dict[str, Any] = {"bytes": len(data), "file_name": file_name}

    is_pdf = "pdf" in mime_type or name.endswith(".pdf")
    is_csv = ("csv" in mime_type) or name.endswith((".csv", ".tsv", ".txt"))
    is_xml = "xml" in mime_type or name.endswith(".xml")
    is_xer = name.endswith(".xer")

    if is_csv:
        tasks = parse_csv_bytes(data)
        if tasks:
            return ParseOutcome(canonicalise_locations(tasks), "csv", {**stats, "count": len(tasks)})

    if is_xer:
        tasks = parse_xer_bytes(data)
        if tasks:
            return ParseOutcome(canonicalise_locations(tasks), "xer", {**stats, "count": len(tasks)})

    if is_xml:
        tasks = parse_xml_bytes(data)
        if tasks:
            return ParseOutcome(canonicalise_locations(tasks), "xml", {**stats, "count": len(tasks)})

    if is_pdf:
        try:
            tasks, strat = parse_pdf_tables(data)
        except Exception:  # noqa: BLE001
            logger.exception("pdfplumber failed")
            tasks, strat = [], "pdf-table"
        if tasks:
            return ParseOutcome(canonicalise_locations(tasks), strat, {**stats, "count": len(tasks)})

        # Vision fallback
        tasks = vision_extract(data)
        if tasks:
            return ParseOutcome(canonicalise_locations(tasks), "pdf-vision", {**stats, "count": len(tasks)})

    # Last resort: try each strategy in turn regardless of hints
    for fn, label in (
        (parse_csv_bytes, "csv"),
        (parse_xer_bytes, "xer"),
        (parse_xml_bytes, "xml"),
    ):
        try:
            tasks = fn(data)
        except Exception:  # noqa: BLE001
            tasks = []
        if tasks:
            return ParseOutcome(canonicalise_locations(tasks), label, {**stats, "count": len(tasks)})

    elapsed = (datetime.utcnow() - started).total_seconds()
    return ParseOutcome([], "none", {**stats, "count": 0, "elapsed_seconds": round(elapsed, 2)})

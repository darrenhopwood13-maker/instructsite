"""FastAPI entrypoint for the Randall programme parser."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Any

import httpx
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from parser import ParseOutcome, parse_programme

logger = logging.getLogger("programme-parser")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

SECRET = os.environ.get("PROGRAMME_PARSER_SECRET", "")

app = FastAPI(title="Randall Programme Parser", version="1.0.0")


class ParseRequest(BaseModel):
    job_id: str = Field(..., min_length=1)
    project_id: str = Field(..., min_length=1)
    signed_url: str = Field(..., min_length=1)
    file_name: str = Field(..., min_length=1)
    mime_type: str = Field(default="application/pdf")
    callback_url: str = Field(..., min_length=1)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/parse", status_code=202)
async def parse(req: ParseRequest, request: Request, bg: BackgroundTasks) -> dict[str, str]:
    if not SECRET:
        raise HTTPException(500, "PROGRAMME_PARSER_SECRET not configured")
    # Caller authentication — Lovable sends the same shared secret as bearer.
    auth = request.headers.get("authorization", "")
    if auth != f"Bearer {SECRET}":
        raise HTTPException(401, "Unauthorized")
    bg.add_task(run_job, req)
    return {"job_id": req.job_id, "status": "accepted"}


async def run_job(req: ParseRequest) -> None:
    started = time.time()
    try:
        await send_callback(req, {
            "status": "parsing",
            "stage": "download",
            "progress": 5,
        })

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.get(req.signed_url)
            resp.raise_for_status()
            data = resp.content

        logger.info("[job %s] downloaded %d bytes", req.job_id, len(data))

        await send_callback(req, {
            "status": "parsing",
            "stage": "extracting",
            "progress": 20,
        })

        outcome: ParseOutcome = await asyncio.to_thread(
            parse_programme,
            data=data,
            file_name=req.file_name,
            mime_type=req.mime_type,
        )

        await send_callback(req, {
            "status": "writing",
            "stage": "callback",
            "progress": 85,
            "strategy": outcome.strategy,
            "tasks": [t.model_dump() for t in outcome.tasks],
            "stats": {
                **outcome.stats,
                "elapsed_seconds": round(time.time() - started, 2),
            },
        })
    except Exception as exc:  # noqa: BLE001 - top-level worker guard
        logger.exception("[job %s] failed", req.job_id)
        await send_callback(req, {
            "status": "failed",
            "error": f"{type(exc).__name__}: {exc}",
            "progress": 100,
        })


async def send_callback(req: ParseRequest, payload: dict[str, Any]) -> None:
    body = json.dumps({
        "job_id": req.job_id,
        "project_id": req.project_id,
        **payload,
    }, separators=(",", ":"))
    signature = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    try:
        async with httpx.AsyncClient(timeout=45) as client:
            r = await client.post(
                req.callback_url,
                content=body,
                headers={
                    "content-type": "application/json",
                    "x-signature": signature,
                },
            )
            r.raise_for_status()
    except Exception:  # noqa: BLE001 - callbacks best-effort; log and continue
        logger.exception("[job %s] callback failed", req.job_id)

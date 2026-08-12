from __future__ import annotations

import json
import os
import re
import shutil
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel, Field

from journal_engine import analyze_archive, generate_pdf, load_analysis

BASE_DIR = Path(__file__).resolve().parent
TEMPLATES = Jinja2Templates(directory=str(BASE_DIR / "templates"))
SESSION_ROOT = Path(tempfile.gettempdir()) / "journal_pdf_web_sessions"
SESSION_ROOT.mkdir(parents=True, exist_ok=True)
SESSION_TTL = 12 * 3600
APP_VERSION = "1.1.0"

app = FastAPI(title="Журнал групи -> PDF", docs_url=None, redoc_url=None)


def cleanup_old_sessions():
    now = time.time()
    for p in SESSION_ROOT.iterdir():
        try:
            if p.is_dir() and now - p.stat().st_mtime > SESSION_TTL:
                shutil.rmtree(p, ignore_errors=True)
        except Exception:
            pass


def session_dir(session_id: str) -> Path:
    if not re.fullmatch(r"[a-f0-9-]{36}", session_id):
        raise HTTPException(400, "Некоректний ідентифікатор сесії.")
    p = SESSION_ROOT / session_id
    if not p.is_dir():
        raise HTTPException(404, "Сесію не знайдено. Завантажте архів ще раз.")
    return p


def atomic_json(path: Path, payload: Dict[str, Any]):
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def read_json(path: Path, fallback: Dict[str, Any] | None = None):
    if not path.exists():
        return fallback or {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return fallback or {}


def write_progress(sdir: Path, **kwargs):
    path = sdir / "progress.json"
    current = read_json(path, {})
    current.update(kwargs)
    current["updated_at"] = time.time()
    atomic_json(path, current)


class GenerateRequest(BaseModel):
    session_id: str
    overrides: Dict[str, Dict[str, Any]] = Field(default_factory=dict)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    cleanup_old_sessions()
    return TEMPLATES.TemplateResponse(request=request, name="index.html", context={"app_version": APP_VERSION})


@app.post("/api/analyze/start")
async def analyze_start(file: UploadFile = File(...)):
    cleanup_old_sessions()
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(400, "Оберіть ZIP-архів із журналами .xlsx/.xlsm.")

    sid = str(uuid.uuid4())
    sdir = SESSION_ROOT / sid
    sdir.mkdir(parents=True, exist_ok=False)
    zip_path = sdir / "input.zip"

    try:
        total = 0
        with open(zip_path, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > 200 * 1024 * 1024:
                    raise HTTPException(413, "ZIP-файл перевищує 200 МБ.")
                out.write(chunk)
    except Exception:
        shutil.rmtree(sdir, ignore_errors=True)
        raise

    write_progress(
        sdir,
        phase="analysis",
        state="queued",
        current=0,
        total=0,
        percent=0,
        item="",
        message="Архів завантажено. Починаю перевірку журналів...",
        version=APP_VERSION,
    )

    def worker():
        try:
            write_progress(sdir, state="running", message="Розпаковую архів та шукаю журнали...")

            def cb(current, total_count, item, stage):
                pct = round((current / total_count * 100) if total_count else 0)
                write_progress(
                    sdir,
                    phase="analysis",
                    state="running",
                    current=current,
                    total=total_count,
                    percent=pct,
                    item=item,
                    message=(f"Перевірено {current} з {total_count}" if total_count else "Аналізую архів..."),
                )

            result = analyze_archive(str(zip_path), str(sdir), progress_cb=cb)
            write_progress(
                sdir,
                phase="analysis",
                state="done",
                current=result["files_count"],
                total=result["files_count"],
                percent=100,
                item="",
                message=f"Перевірку завершено. Знайдено журналів: {result['journals_count']}.",
            )
        except Exception as e:
            write_progress(sdir, phase="analysis", state="error", message=f"Помилка аналізу архіву: {e}")

    threading.Thread(target=worker, daemon=True).start()
    return {"session_id": sid, "version": APP_VERSION}


@app.get("/api/progress/{session_id}")
def progress(session_id: str):
    sdir = session_dir(session_id)
    data = read_json(sdir / "progress.json", {"state": "unknown", "percent": 0})
    if data.get("phase") == "analysis" and data.get("state") == "done":
        try:
            analysis = load_analysis(str(sdir))
            data["result"] = {
                "session_id": session_id,
                "group": analysis["group"],
                "files_count": analysis["files_count"],
                "journals_count": analysis["journals_count"],
                "subjects": analysis["subjects"],
                "warnings": analysis["warnings"],
            }
        except Exception:
            pass
    if data.get("phase") == "pdf" and data.get("state") == "done":
        result = read_json(sdir / "last_result.json", {})
        data["result"] = {
            "ok": True,
            "download_url": f"/api/download/{session_id}",
            **result,
        }
    return data


@app.post("/api/generate/start")
def generate_start(req: GenerateRequest):
    sdir = session_dir(req.session_id)
    analysis = load_analysis(str(sdir))
    group = re.sub(r"[^0-9A-Za-zА-Яа-яІіЇїЄєҐґ_-]+", "_", analysis.get("group", "Група")).strip("_") or "Група"
    output = sdir / f"Журнал_групи_{group}.pdf"

    write_progress(
        sdir,
        phase="pdf",
        state="queued",
        current=0,
        total=analysis.get("journals_count", 0),
        percent=0,
        item="",
        message="Готую сторінки майбутнього журналу...",
        version=APP_VERSION,
    )

    def worker():
        try:
            def cb(current, total_count, item, stage):
                pct = round((current / total_count * 100) if total_count else 0)
                write_progress(
                    sdir,
                    phase="pdf",
                    state="running",
                    current=current,
                    total=total_count,
                    percent=pct,
                    item=item,
                    message=(f"Оброблено {current} з {total_count} предметів" if total_count else "Формую PDF..."),
                )

            info = generate_pdf(str(sdir), req.overrides, str(output), progress_cb=cb)
            atomic_json(sdir / "last_result.json", info)
            write_progress(
                sdir,
                phase="pdf",
                state="done",
                current=analysis.get("journals_count", 0),
                total=analysis.get("journals_count", 0),
                percent=100,
                item="",
                message=f"Журнал готовий: {info.get('pages', 0)} сторінок.",
            )
        except Exception as e:
            write_progress(sdir, phase="pdf", state="error", message=f"Помилка формування PDF: {e}")

    threading.Thread(target=worker, daemon=True).start()
    return {"ok": True, "session_id": req.session_id}


@app.get("/api/download/{session_id}")
def download(session_id: str):
    sdir = session_dir(session_id)
    files = list(sdir.glob("Журнал_групи_*.pdf"))
    if not files:
        raise HTTPException(404, "PDF ще не сформовано.")
    path = files[-1]
    return FileResponse(path, media_type="application/pdf", filename=path.name)

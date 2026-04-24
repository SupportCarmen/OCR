"""
FastAPI Application Entry Point
================================
AI OCR Bank Receipt / Invoice Automation Backend

Start the server:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import sys
import io
import logging
import traceback
from contextlib import asynccontextmanager

# ── Force UTF-8 on Windows (prevents 'charmap' codec errors with Thai text) ──
if sys.platform == "win32":
    # Reconfigure stdout/stderr to UTF-8
    for _stream_name in ("stdout", "stderr"):
        _stream = getattr(sys, _stream_name)
        if hasattr(_stream, "buffer"):
            setattr(
                sys, _stream_name,
                io.TextIOWrapper(_stream.buffer, encoding="utf-8", errors="replace", line_buffering=True),
            )

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db, migrate_db
from app.routers.ocr import router as ocr_router
from app.routers.mapping import router as mapping_router
from app.routers.carmen import router as carmen_router
from app.routers.tools import router as tools_router
from app.routers.feedback import router as feedback_router
from app.routers.ap_invoice import router as ap_invoice_router


# ── Logging Setup (uses the reconfigured UTF-8 stderr) ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,  # override any handlers uvicorn may have set up
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    logger.info("🚀 Starting AI OCR Bank Receipt Backend...")
    logger.info(f"   OCR Model  : {settings.openrouter_ocr_model}")
    logger.info(f"   Sugg Model : {settings.openrouter_suggestion_model}")
    logger.info(f"   OpenRouter : {'✅ Configured' if settings.openrouter_api_key else '❌ Not set'}")
    logger.info(f"   Upload Dir : {settings.upload_dir}")
    logger.info(f"   Database   : {settings.database_url}")

    await init_db()
    await migrate_db()
    logger.info("✅ Database initialized")

    yield

    logger.info("👋 Shutting down AI OCR Backend")


# ── FastAPI App ──
# Backend Version: 1.0.4 - Mapping Fix Debug V4
app = FastAPI(
    title="AI OCR Bank Receipt Backend",
    description=(
        "ระบบ AI OCR สำหรับอ่านใบเสร็จรับเงิน/ใบกำกับภาษีจากธนาคาร "
        "แล้วดึงข้อมูลออกมาเป็น Structured Data อัตโนมัติ\n\n"
        "**Features:**\n"
        "- 📄 อัปโหลดรูปใบเสร็จ (JPG/PNG/PDF)\n"
        "- 🤖 AI OCR ดึงข้อความจากรูป (Google Vision / PaddleOCR)\n"
        "- 🧠 AI Extraction แยกข้อมูลเป็น Structured Fields\n"
        "- 📊 Export เป็น CSV (ฟอร์แมต Bank Tax Automation)\n"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS Middleware ──
origins = [origin.strip() for origin in settings.allowed_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=settings.allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global error handler ──
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    try:
        logger.error("Unhandled exception: %s %s\n%s", request.method, request.url, tb)
    except Exception:
        pass  # avoid recursive encoding errors in the handler
    content = {"detail": str(exc)}
    if settings.app_debug:
        content["traceback"] = tb
    return JSONResponse(status_code=500, content=content)


# ── Register Routers ──
app.include_router(ocr_router)
app.include_router(mapping_router)
app.include_router(carmen_router)
app.include_router(tools_router)
app.include_router(feedback_router)
app.include_router(ap_invoice_router)


# Root endpoint ──
@app.get("/", tags=["Root"])
async def root():
    return {
        "app": "AI OCR Bank Receipt Backend",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/ocr/health",
    }

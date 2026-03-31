"""
FastAPI Application Entry Point
================================
AI OCR Bank Receipt / Invoice Automation Backend

Start the server:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers.ocr import router as ocr_router


# ── Logging Setup ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    logger.info("🚀 Starting AI OCR Bank Receipt Backend...")
    logger.info(f"   OCR Engine : {settings.ocr_engine} ({settings.openrouter_model})")
    logger.info(f"   OpenRouter : {'✅ Configured' if settings.openrouter_api_key else '❌ Not set'}")
    logger.info(f"   Upload Dir : {settings.upload_dir}")
    logger.info(f"   Database   : {settings.database_url}")

    await init_db()
    logger.info("✅ Database initialized")

    yield

    logger.info("👋 Shutting down AI OCR Backend")


# ── FastAPI App ──
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ──
app.include_router(ocr_router)


# ── Root endpoint ──
@app.get("/", tags=["Root"])
async def root():
    return {
        "app": "AI OCR Bank Receipt Backend",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/ocr/health",
    }

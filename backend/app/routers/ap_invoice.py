import logging
import json
import base64
import os
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.services.ap_invoice_service import extract_ap_invoice_data, suggest_gl_for_items
from app.services.carmen_service import get_account_codes, get_departments, CarmenAPIError
from app.database import get_db
from app.models.orm import OCRTask, TaskStatus
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ap-invoice", tags=["AP Invoice"])

def _get_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".bmp": "image/bmp",
        ".pdf": "application/pdf",
    }.get(ext, "image/jpeg")

@router.post("/extract")
async def extract_ap_invoice(
    file: UploadFile = File(..., description="รูปใบแจ้งหนี้/ใบกำกับภาษี AP (JPG, PNG, PDF)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Stateless AP Invoice OCR extraction using Vision LLM (OpenRouter).
    Passes the file to Gemini 2.5 Flash/Claude to extract structured item lines.
    """
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    file_bytes = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_file_size_mb}MB limit")

    mime_type = _get_mime_type(file.filename)
    b64_image = base64.b64encode(file_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_image}"

    # Create task for tracking
    task = OCRTask(
        id=str(uuid.uuid4()),
        original_filename=file.filename,
        file_path="STATLESS_AP_INVOICE",
        status=TaskStatus.COMPLETED,
        ocr_engine=settings.ocr_engine,
    )
    db.add(task)
    await db.commit()
    task_id = task.id

    try:
        return await extract_ap_invoice_data(data_url, file.filename, task_id)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


class SuggestGLItem(BaseModel):
    index: int
    category: str = ""
    description: str = ""

class SuggestGLRequest(BaseModel):
    items: List[SuggestGLItem]





@router.post("/suggest-gl")
async def suggest_gl(body: SuggestGLRequest):
    """AI-suggest dept/acc for AP invoice expense items using category + description."""
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")
    if not body.items:
        return {"suggestions": {}}

    try:
        accounts_raw = await get_account_codes()
        depts_raw = await get_departments()
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Carmen API error: {e.detail}")

    items_payload = [{"index": i.index, "category": i.category, "description": i.description} for i in body.items]
    suggestions = await suggest_gl_for_items(items_payload, accounts_raw, depts_raw)
    return {"suggestions": suggestions}

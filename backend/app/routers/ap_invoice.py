import logging
import json
import base64
import os
from typing import Optional, List

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.llm.client import get_client
from app.llm.prompts.ap_invoice import PROMPT as AP_INVOICE_PROMPT
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

    prompt = AP_INVOICE_PROMPT

    ap_model = settings.openrouter_ap_invoice_model or settings.openrouter_ocr_model
    logger.info(f"Extracting AP Invoice: {file.filename} (model: {ap_model})")
    client = get_client()

    try:
        response = await client.chat.completions.create(
            model=ap_model,
            messages=[
                {
                    "role": "system",
                    "content": prompt,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                        {
                            "type": "text",
                            "text": "Extract details and return JSON.",
                        },
                    ],
                },
            ],
            temperature=0.0,
            max_tokens=8192,
        )
    except Exception as e:
        logger.error(f"LLM API Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to connect to LLM service")

    if response.usage:
        from app.services.usage_service import log_llm_usage
        await log_llm_usage(
            model=ap_model,
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            task_id=task_id,
            usage_type="AP_INVOICE"
        )

    raw_content = response.choices[0].message.content if (response.choices and response.choices[0].message) else None
    if not raw_content:
        raise HTTPException(status_code=500, detail="Empty response from LLM")

    result_text = raw_content.strip()
    if result_text.startswith("```"):
        lines = result_text.split("\n")
        if len(lines) > 1:
            last_line = lines[-1].strip()
            result_text = "\n".join(lines[1:-1] if last_line == "```" else lines[1:])
            result_text = result_text.strip()

    try:
        data = json.loads(result_text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON Decode Error. Raw text: {result_text}")
        raise HTTPException(status_code=500, detail="LLM returned invalid JSON")

    return data

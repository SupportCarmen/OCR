"""
OCR API Routes.
"""

import logging
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.models import (
    OCRTaskResponse,
    OCRTaskListResponse,
    OCRUploadResponse,
    ExportResponse,
    ExtractedReceiptData,
    TaskStatus,
)
from app.services.ocr_service import (
    process_single_file,
    get_task_by_id,
    get_all_tasks,
    export_tasks_to_csv,
)
from app.utils.image_processing import is_valid_image

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ocr", tags=["OCR"])


def _task_to_response(task) -> OCRTaskResponse:
    """Convert an OCRTask DB object to an API response."""
    extracted = ExtractedReceiptData(
        bank_name=task.bank_name,
        doc_name=task.doc_name,
        company_name=task.company_name,
        doc_date=task.doc_date,
        doc_no=task.doc_no,
        terminal_id=task.terminal_id,
        pay_amt=task.pay_amt,
        commis_amt=task.commis_amt,
        tax_amt=task.tax_amt,
        total=task.total,
        wht_amount=task.wht_amount,
    )

    return OCRTaskResponse(
        id=task.id,
        filename=task.filename,
        original_filename=task.original_filename,
        status=task.status,
        ocr_engine=task.ocr_engine,
        raw_text=task.raw_text,
        error_message=task.error_message,
        created_at=task.created_at,
        completed_at=task.completed_at,
        extracted_data=extracted,
    )


# ═══════════════════════════════════════════════════
# POST /api/v1/ocr/extract — Upload & process files
# ═══════════════════════════════════════════════════

@router.post("/extract", response_model=OCRUploadResponse)
async def extract_receipt(
    files: List[UploadFile] = File(..., description="รูปใบเสร็จ/Invoice (JPG, PNG, PDF)"),
    db: AsyncSession = Depends(get_db),
):
    """
    อัปโหลดรูปใบเสร็จรับเงิน/ใบกำกับภาษี แล้วระบบจะดึงข้อมูลออกมาให้อัตโนมัติ

    - รองรับไฟล์: JPG, PNG, BMP, TIFF, WebP, PDF
    - สามารถอัปโหลดหลายไฟล์พร้อมกันได้
    - ผลลัพธ์จะถูกบันทึกลงฐานข้อมูลและสามารถ Export เป็น CSV ได้
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    task_ids = []

    for upload_file in files:
        # Validate file type
        if not is_valid_image(upload_file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {upload_file.filename}. "
                       f"Supported: JPG, PNG, BMP, TIFF, WebP, PDF"
            )

        # Validate file size
        file_bytes = await upload_file.read()
        max_bytes = settings.max_file_size_mb * 1024 * 1024
        if len(file_bytes) > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File {upload_file.filename} exceeds max size ({settings.max_file_size_mb}MB)"
            )

        # Process
        task = await process_single_file(
            db=db,
            file_bytes=file_bytes,
            original_filename=upload_file.filename,
        )
        task_ids.append(task.id)

    return OCRUploadResponse(
        message=f"Processed {len(task_ids)} file(s) successfully",
        task_ids=task_ids,
        total_files=len(task_ids),
    )


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/tasks — List all tasks
# ═══════════════════════════════════════════════════

@router.get("/tasks", response_model=OCRTaskListResponse)
async def list_tasks(
    status: Optional[TaskStatus] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """ดึงรายการ OCR tasks ทั้งหมด พร้อม filter ตามสถานะ"""
    tasks, total = await get_all_tasks(db, status=status, limit=limit, offset=offset)
    return OCRTaskListResponse(
        total=total,
        tasks=[_task_to_response(t) for t in tasks],
    )


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/tasks/{task_id} — Get single task
# ═══════════════════════════════════════════════════

@router.get("/tasks/{task_id}", response_model=OCRTaskResponse)
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
):
    """ดึงผลลัพธ์ OCR task ตาม ID"""
    task = await get_task_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return _task_to_response(task)


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/export — Export to CSV
# ═══════════════════════════════════════════════════

@router.get("/export")
async def export_csv(
    db: AsyncSession = Depends(get_db),
):
    """
    Export ข้อมูลที่ดึงได้ทั้งหมดเป็นไฟล์ CSV
    (ฟอร์แมตเดียวกับ Bank Tax Automation CSV)
    """
    csv_path = await export_tasks_to_csv(db)
    return FileResponse(
        path=csv_path,
        media_type="text/csv",
        filename=csv_path.split("/")[-1].split("\\")[-1],
        headers={"Content-Disposition": f"attachment; filename={csv_path.split('/')[-1].split(chr(92))[-1]}"},
    )


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/health — Health check
# ═══════════════════════════════════════════════════

@router.get("/health")
async def health_check():
    """ตรวจสอบสถานะระบบ"""
    return {
        "status": "healthy",
        "ocr_engine": settings.ocr_engine,
        "openrouter_model": settings.openrouter_model,
        "openrouter_configured": bool(settings.openrouter_api_key),
        "timestamp": datetime.utcnow().isoformat(),
    }

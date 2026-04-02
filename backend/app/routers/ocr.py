"""
OCR API Routes.
"""

import logging
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.config import settings
from app.models import (
    OCRUploadResponse,
    TaskStatus,
    BankType,
    OCRTask,
    Receipt,
    ReceiptDetail,
)
from app.services.ocr_service import process_single_file, get_all_tasks, export_tasks_to_csv
from app.utils.image_processing import is_valid_image


# ── Pydantic schemas for submit endpoint ────────────
class SubmitDetailItem(BaseModel):
    TerminalID: Optional[str] = None
    PayAmt: Optional[float] = 0
    CommisAmt: Optional[float] = 0
    TaxAmt: Optional[float] = 0
    WHTAmount: Optional[float] = 0
    Total: Optional[float] = 0

class SubmitHeader(BaseModel):
    DateProcessed: Optional[str] = None
    BankName: Optional[str] = None
    DocName: Optional[str] = None
    CompanyName: Optional[str] = None
    DocDate: Optional[str] = None
    DocNo: Optional[str] = None

class SubmitPayload(BaseModel):
    BankType: Optional[str] = None
    Overwrite: bool = False
    Header: SubmitHeader
    Details: List[SubmitDetailItem] = []

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ocr", tags=["OCR"])


# ═══════════════════════════════════════════════════
# POST /api/v1/ocr/extract
# ═══════════════════════════════════════════════════

@router.post("/extract", response_model=OCRUploadResponse)
async def extract_receipt(
    files: List[UploadFile] = File(..., description="รูปใบเสร็จ (JPG, PNG, PDF)"),
    bank_type: Optional[BankType] = Query(None, description="ประเภทธนาคาร BBL/KBANK/SCB"),
    db: AsyncSession = Depends(get_db),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    task_ids = []

    for upload_file in files:
        if not is_valid_image(upload_file.filename):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {upload_file.filename}",
            )

        file_bytes = await upload_file.read()
        max_bytes = settings.max_file_size_mb * 1024 * 1024
        if len(file_bytes) > max_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"{upload_file.filename} exceeds {settings.max_file_size_mb}MB limit",
            )

        task = await process_single_file(
            db=db,
            file_bytes=file_bytes,
            original_filename=upload_file.filename,
            bank_type=bank_type.value if bank_type else None,
        )
        task_ids.append(task.id)

    return OCRUploadResponse(
        message=f"Processed {len(task_ids)} file(s) successfully",
        task_ids=task_ids,
        total_files=len(task_ids),
    )


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/tasks
# ═══════════════════════════════════════════════════

@router.get("/tasks")
async def list_tasks(
    status: Optional[TaskStatus] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    tasks, total = await get_all_tasks(db, status=status, limit=limit, offset=offset)
    return JSONResponse(content={
        "total": total,
        "tasks": [
            {
                "id": t.id,
                "original_filename": t.original_filename,
                "status": t.status.value if hasattr(t.status, "value") else t.status,
                "ocr_engine": t.ocr_engine,
                "error_message": t.error_message,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in tasks
        ],
    })


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/tasks/{task_id}
# ═══════════════════════════════════════════════════

@router.get("/tasks/{task_id}")
async def get_task(task_id: str, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(OCRTask)
            .options(selectinload(OCRTask.receipt).selectinload(Receipt.details))
            .where(OCRTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

        receipt = task.receipt
        details = []
        if receipt:
            for d in receipt.details:
                details.append({
                    "terminal_id": d.terminal_id,
                    "pay_amt": float(d.pay_amt) if d.pay_amt is not None else None,
                    "commis_amt": float(d.commis_amt) if d.commis_amt is not None else None,
                    "tax_amt": float(d.tax_amt) if d.tax_amt is not None else None,
                    "wht_amount": float(d.wht_amount) if d.wht_amount is not None else None,
                    "total": float(d.total) if d.total is not None else None,
                })

        return JSONResponse(content={
            "id": task.id,
            "original_filename": task.original_filename,
            "status": task.status.value if hasattr(task.status, "value") else task.status,
            "ocr_engine": task.ocr_engine,
            "error_message": task.error_message,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "receipt": {
                "id": receipt.id,
                "task_id": receipt.task_id,
                "bank_name": receipt.bank_name,
                "bank_type": receipt.bank_type.value if receipt.bank_type and hasattr(receipt.bank_type, "value") else receipt.bank_type,
                "doc_name": receipt.doc_name,
                "company_name": receipt.company_name,
                "doc_date": receipt.doc_date,
                "doc_no": receipt.doc_no,
                "submitted_at": receipt.submitted_at.isoformat() if receipt.submitted_at else None,
                "created_at": receipt.created_at.isoformat() if receipt.created_at else None,
                "details": details,
            } if receipt else None,
        })
    except HTTPException:
        raise
    except Exception:
        logger.error(f"get_task({task_id}) failed", exc_info=True)
        raise


# ═══════════════════════════════════════════════════
# PATCH /api/v1/ocr/receipts/{receipt_id}/submit
# ═══════════════════════════════════════════════════

@router.patch("/receipts/{receipt_id}/submit")
async def mark_receipt_submitted(receipt_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Receipt).where(Receipt.id == receipt_id))
    receipt = result.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail=f"Receipt {receipt_id} not found")
    receipt.submitted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True, "submitted_at": receipt.submitted_at.isoformat()}


# ═══════════════════════════════════════════════════
# POST /api/v1/ocr/receipts/{receipt_id}/submit-local
# Save edited data to local DB and mark as submitted
# ═══════════════════════════════════════════════════

@router.post("/receipts/{receipt_id}/submit-local")
async def submit_receipt_local(
    receipt_id: str,
    payload: SubmitPayload,
    db: AsyncSession = Depends(get_db),
):
    """Save user-edited header + details to local DB and mark as submitted."""

    # 1. Find receipt
    result = await db.execute(select(Receipt).where(Receipt.id == receipt_id))
    receipt = result.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail=f"Receipt {receipt_id} not found")

    # 1.5 Check if already submitted
    if receipt.submitted_at is not None:
        return {
            "ok": False,
            "error": "ALREADY_SUBMITTED",
            "detail": f"เอกสารถูก submit ไปแล้วเมื่อ {receipt.submitted_at.isoformat()}"
        }

    # 1.6 Duplicate doc_no check — only among submitted receipts
    doc_no = payload.Header.DocNo
    if doc_no:
        dup_result = await db.execute(
            select(Receipt).where(
                Receipt.doc_no == doc_no,
                Receipt.submitted_at.isnot(None),
                Receipt.id != receipt_id,
            )
        )
        existing_receipts = dup_result.scalars().all()
        if existing_receipts:
            if payload.Overwrite:
                # User confirmed overwrite: delete the old submitted records
                logger.info(f"Overwriting {len(existing_receipts)} existing submitted record(s) for Doc No: {doc_no}")
                for old_r in existing_receipts:
                    await db.delete(old_r)
                # Note: cascade delete in DB (or relationship) should handle details
            else:
                return {
                    "ok": False,
                    "error": "DUPLICATE_DOC_NO",
                    "doc_no": doc_no,
                    "detail": f"หมายเลข {doc_no} ถูก submit ไปแล้ว"
                }

    # 2. Update header fields from payload
    receipt.bank_name = payload.Header.BankName
    receipt.bank_type = payload.BankType if payload.BankType in ("BBL", "KBANK", "SCB") else receipt.bank_type
    receipt.doc_name = payload.Header.DocName
    receipt.company_name = payload.Header.CompanyName
    receipt.doc_date = payload.Header.DocDate
    receipt.doc_no = payload.Header.DocNo
    receipt.submitted_at = datetime.utcnow()

    # 3. Replace detail rows — delete old, insert new
    await db.execute(
        delete(ReceiptDetail).where(ReceiptDetail.receipt_id == receipt_id)
    )

    for item in payload.Details:
        detail = ReceiptDetail(
            receipt_id=receipt_id,
            terminal_id=item.TerminalID,
            pay_amt=Decimal(str(item.PayAmt or 0)),
            commis_amt=Decimal(str(item.CommisAmt or 0)),
            tax_amt=Decimal(str(item.TaxAmt or 0)),
            wht_amount=Decimal(str(item.WHTAmount or 0)),
            total=Decimal(str(item.Total or 0)),
        )
        db.add(detail)

    await db.commit()

    logger.info(f"Receipt {receipt_id} submitted locally (doc_no={receipt.doc_no})")
    return {
        "ok": True,
        "receipt_id": receipt_id,
        "doc_no": receipt.doc_no,
        "submitted_at": receipt.submitted_at.isoformat(),
    }


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/export
# ═══════════════════════════════════════════════════

@router.get("/export")
async def export_csv(db: AsyncSession = Depends(get_db)):
    csv_path = await export_tasks_to_csv(db)
    filename = csv_path.replace("\\", "/").split("/")[-1]
    return FileResponse(
        path=csv_path,
        media_type="text/csv",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/health
# ═══════════════════════════════════════════════════

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "ocr_engine": settings.ocr_engine,
        "openrouter_model": settings.openrouter_model,
        "openrouter_configured": bool(settings.openrouter_api_key),
        "timestamp": datetime.utcnow().isoformat(),
    }

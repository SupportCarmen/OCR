"""
OCR API Routes — thin HTTP layer.

Business logic lives in:
  app/tools/extract.py  — OCR extraction
  app/tools/submit.py   — receipt persistence
  app/services/ocr_service.py — task/export helpers
Carmen proxy endpoints live in app/routers/carmen.py.
"""

import logging
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Request, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.config import settings
from app.models import (
    TaskStatus,
    BankType,
    OCRTask,
    Receipt,
    ExtractedReceiptData,
)
from app.services import ocr_service
from app.services.correction_service import get_correction_hints
from app.tools import submit as submit_tool
from app.tools.submit import SubmitInput
from app.utils.image_processing import is_valid_image
from app.auth import get_current_session, SessionInfo
from app.services import audit_service
from app.context import current_document_ref


# ── Pydantic schemas for submit endpoint ────────────
# Frontend sends amount fields too (PayAmt/CommisAmt/TaxAmt/WHTAmount/Total)
# but only Transaction is persisted; the rest are silently ignored.
class SubmitDetailItem(BaseModel):
    model_config = ConfigDict(extra='ignore', populate_by_name=True)
    Transaction: Optional[str] = Field(None, alias="transaction")

class SubmitHeader(BaseModel):
    # Accepts MerchantId from frontend for display continuity but it is NOT persisted.
    model_config = ConfigDict(extra='ignore', populate_by_name=True)
    DateProcessed:  Optional[str] = Field(None, alias="date_processed")
    BankName:       Optional[str] = Field(None, alias="bank_name")
    DocName:        Optional[str] = Field(None, alias="doc_name")
    CompanyName:    Optional[str] = Field(None, alias="company_name")
    DocDate:        Optional[str] = Field(None, alias="doc_date")
    DocNo:          Optional[str] = Field(None, alias="doc_no")
    MerchantName:   Optional[str] = Field(None, alias="merchant_name")
    MerchantId:     Optional[str] = Field(None, alias="merchant_id")

class SubmitPayload(BaseModel):
    model_config = ConfigDict(extra='ignore', populate_by_name=True)
    BankType:         Optional[str] = Field(None, alias="bank_type")
    OriginalFilename: Optional[str] = Field(None, alias="original_filename")
    Header:           SubmitHeader
    Details:          List[SubmitDetailItem] = []

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ocr", tags=["OCR"])


# ═══════════════════════════════════════════════════
# POST /api/v1/ocr/extract
# ═══════════════════════════════════════════════════

@router.post("/extract", response_model=List[ExtractedReceiptData])
async def extract_receipt(
    request: Request,
    files: List[UploadFile] = File(..., description="รูปใบเสร็จ (JPG, PNG, PDF)"),
    bank_type: Optional[BankType] = Query(None, description="ประเภทธนาคาร BBL/KBANK/SCB"),
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    """
    Stateless extraction: read files, call LLM, return JSON data.
    Does NOT save to DB or Disk.
    Sets is_duplicate=True if doc_no already exists in submitted receipts.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    filenames = ", ".join(f.filename for f in files)
    current_document_ref.set(filenames)
    await audit_service.log_action(
        _session, audit_service.EXTRACT, audit_service.CREDIT_CARD,
        document_ref=filenames, ip_address=request.client.host if request.client else None,
    )

    results = []
    bank_type_str = bank_type.value if bank_type else None
    hints = await get_correction_hints(bank_type_str, db) if bank_type_str else {}

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

        task = OCRTask(
            id=str(uuid.uuid4()),
            original_filename=upload_file.filename,
            file_path="STATELESS_EXTRACTION",
            status=TaskStatus.COMPLETED,
            ocr_engine=settings.ocr_engine,
        )
        db.add(task)
        await db.commit()

        extracted = await ocr_service.extract_stateless(
            file_bytes=file_bytes,
            original_filename=upload_file.filename,
            bank_type=bank_type_str,
            hints=hints or None,
            task_id=task.id,
        )

        if extracted.doc_no:
            dup = await db.execute(
                select(Receipt).where(
                    Receipt.doc_no == extracted.doc_no,
                    Receipt.submitted_at.isnot(None),
                )
            )
            if dup.scalars().first():
                extracted.is_duplicate = True

        results.append(extracted)

    return results


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/tasks
# ═══════════════════════════════════════════════════

@router.get("/tasks")
async def list_tasks(
    status: Optional[TaskStatus] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    tasks, total = await ocr_service.get_all_tasks(db, status=status, limit=limit, offset=offset)
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
async def get_task(
    task_id: str,
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    try:
        result = await db.execute(
            select(OCRTask)
            .options(selectinload(OCRTask.receipt))
            .where(OCRTask.id == task_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

        receipt = task.receipt

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
                "merchant_name": receipt.merchant_name,
                "submitted_at": receipt.submitted_at.isoformat() if receipt.submitted_at else None,
                "created_at": receipt.created_at.isoformat() if receipt.created_at else None,
                "transactions": receipt.transactions or [],
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
async def mark_receipt_submitted(
    receipt_id: str,
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    result = await db.execute(select(Receipt).where(Receipt.id == receipt_id))
    receipt = result.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail=f"Receipt {receipt_id} not found")
    receipt.submitted_at = datetime.utcnow()
    await db.commit()
    return {"ok": True, "submitted_at": receipt.submitted_at.isoformat()}


# ═══════════════════════════════════════════════════
# POST /api/v1/ocr/submit
# ═══════════════════════════════════════════════════

@router.post("/submit")
async def submit_receipt_stateless(
    request: Request,
    payload: SubmitPayload,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    """Save user-confirmed data to DB. Delegates all logic to submit_tool."""
    doc_ref = payload.Header.DocNo or payload.OriginalFilename or ""
    current_document_ref.set(doc_ref)
    await audit_service.log_action(
        session, audit_service.SUBMIT, audit_service.CREDIT_CARD,
        document_ref=doc_ref, ip_address=request.client.host if request.client else None,
    )
    inp = SubmitInput(
        bank_type=payload.BankType,
        original_filename=payload.OriginalFilename or "uploaded_file",
        doc_no=payload.Header.DocNo,
        doc_date=payload.Header.DocDate,
        bank_name=payload.Header.BankName,
        doc_name=payload.Header.DocName,
        company_name=payload.Header.CompanyName,
        merchant_name=payload.Header.MerchantName,
        details=[
            {"transaction": d.Transaction}
            for d in payload.Details
        ],
    )

    result = await submit_tool.run(inp, db)

    if not result.success:
        raise HTTPException(status_code=500, detail=result.errors[0] if result.errors else "Submit failed")

    return {"ok": True, **result.output}


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/export
# ═══════════════════════════════════════════════════

@router.get("/export")
async def export_csv(
    request: Request,
    db: AsyncSession = Depends(get_db),
    session: SessionInfo = Depends(get_current_session),
):
    await audit_service.log_action(
        session, audit_service.EXPORT, audit_service.CREDIT_CARD,
        ip_address=request.client.host if request.client else None,
    )
    csv_path = await ocr_service.export_tasks_to_csv(db)
    filename = csv_path.replace("\\", "/").split("/")[-1]
    return FileResponse(
        path=csv_path,
        media_type="text/csv",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/debug-llm  (debug only)
# ═══════════════════════════════════════════════════

@router.get("/debug-llm")
async def debug_last_llm_response():
    if not settings.app_debug:
        raise HTTPException(status_code=403, detail="Debug mode is disabled")
    import pathlib, tempfile
    p = pathlib.Path(tempfile.gettempdir()) / "last_llm_response.txt"
    if not p.exists():
        return {"raw": "(no response saved yet — process a file first)", "path": str(p)}
    return {"raw": p.read_text(encoding="utf-8"), "path": str(p)}


# ═══════════════════════════════════════════════════
# GET /api/v1/ocr/health  — public, no auth
# ═══════════════════════════════════════════════════

@router.get("/health")
async def health_check():
    return {
        "health": "healthy",
        "ocr_engine": settings.ocr_engine,
        "openrouter_ocr_model": settings.openrouter_ocr_model,
        "openrouter_suggestion_model": settings.openrouter_suggestion_model,
        "openrouter_configured": bool(settings.openrouter_api_key),
        "timestamp": datetime.utcnow().isoformat(),
    }

"""
OCR Service — orchestrates the full pipeline:
  1. Save uploaded file
  2. Pre-process image (resize only — keep colour for vision LLM)
  3. Call OpenRouter vision LLM (OCR + structured extraction in one shot)
  4. Store results in ocr_tasks → receipts → receipt_details
"""

import os
import uuid
import logging
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.config import settings
from app.models import OCRTask, Receipt, ReceiptDetail, TaskStatus, ExtractedReceiptData
from app.utils.image_processing import preprocess_image
from app.services.llm_service import extract_from_image

logger = logging.getLogger(__name__)


def _parse_amount(value: Optional[str]) -> Optional[float]:
    """Convert amount string like '88,911.00' to float."""
    if not value:
        return None
    try:
        return float(str(value).replace(",", ""))
    except ValueError:
        return None


async def extract_stateless(
    file_bytes: bytes,
    original_filename: str,
    bank_type: Optional[str] = None,
    hints: Optional[dict] = None,
) -> ExtractedReceiptData:
    """
    Stateless OCR extraction:
    resize → OpenRouter vision LLM → return structured data.
    Does NOT save to DB or Disk.

    hints: correction hints from correction_feedback (passed to prompt builder).
    """
    ext = os.path.splitext(original_filename)[1].lower()

    # 1. Pre-process / Resize (keep colour)
    if ext == ".pdf":
        processed_bytes = file_bytes
    else:
        processed_bytes = preprocess_image(
            file_bytes,
            grayscale=False,
            contrast_factor=1.0,
            sharpness_factor=1.0,
            denoise=False,
        )

    # 2. Vision LLM
    logger.info(f"Extracting stateless: {original_filename} (bank={bank_type}, hints={len(hints) if hints else 0})")
    _, extracted = await extract_from_image(processed_bytes, original_filename, bank_type, hints=hints)
    return extracted


async def process_single_file(
    db: AsyncSession,
    file_bytes: bytes,
    original_filename: str,
    bank_type: Optional[str] = None,
) -> OCRTask:
    """
    Legacy pipeline for a single uploaded file:
    save → resize → OpenRouter vision LLM → store in ocr_tasks + receipts + receipt_details.
    Receipt is saved with submitted_at=NULL (pending review).
    """
    # ── 1. Save file ──
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(original_filename)[1].lower()
    file_path = os.path.join(settings.upload_dir, f"{file_id}{ext}")

    if not os.path.exists(settings.upload_dir):
        os.makedirs(settings.upload_dir, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # ── 2. Create task record ──
    task = OCRTask(
        id=file_id,
        original_filename=original_filename,
        file_path=file_path,
        status=TaskStatus.PROCESSING,
        ocr_engine=settings.ocr_engine,
    )
    db.add(task)
    await db.flush()

    try:
        # ── 3. OCR Extraction ──
        extracted = await extract_stateless(file_bytes, original_filename, bank_type)

        # ── 4. Create Receipt (header) — submitted_at=NULL = pending review ──
        receipt = Receipt(
            task_id=task.id,
            bank_name=extracted.bank_name,
            bank_type=bank_type,
            doc_name=extracted.doc_name,
            company_name=extracted.company_name,
            company_tax_id=extracted.company_tax_id,
            company_address=extracted.company_address,
            account_no=extracted.account_no,
            doc_date=extracted.doc_date,
            doc_no=extracted.doc_no,
            merchant_name=extracted.merchant_name,
            merchant_id=extracted.merchant_id,
            wht_rate=extracted.wht_rate,
            wht_amount=_parse_amount(extracted.wht_amount),
            net_amount=_parse_amount(extracted.net_amount),
            bank_companyname=extracted.bank_companyname,
            bank_tax_id=extracted.bank_tax_id,
            bank_address=extracted.bank_address,
            branch_no=extracted.branch_no,
        )
        db.add(receipt)
        await db.flush()

        # ── 5. Create ReceiptDetail rows ──
        for row in extracted.details:
            db.add(ReceiptDetail(
                receipt_id=receipt.id,
                transaction=row.transaction,
                pay_amt=_parse_amount(row.pay_amt),
                commis_amt=_parse_amount(row.commis_amt),
                tax_amt=_parse_amount(row.tax_amt),
                wht_amount=None,
                total=_parse_amount(row.total),
            ))

        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.utcnow()

    except Exception as e:
        logger.error(f"[{file_id}] ❌ Failed: {e}")
        task.status = TaskStatus.FAILED
        task.error_message = str(e)
        task.completed_at = datetime.utcnow()

    await db.commit()
    return task


async def get_task_by_id(db: AsyncSession, task_id: str) -> Optional[OCRTask]:
    result = await db.execute(
        select(OCRTask).where(OCRTask.id == task_id)
    )
    return result.scalar_one_or_none()


async def get_all_tasks(
    db: AsyncSession,
    status: Optional[TaskStatus] = None,
    limit: int = 100,
    offset: int = 0,
) -> Tuple[List[OCRTask], int]:
    query = select(OCRTask)
    if status:
        query = query.where(OCRTask.status == status)
    query = query.order_by(desc(OCRTask.created_at))

    count_query = select(func.count()).select_from(OCRTask)
    if status:
        count_query = count_query.where(OCRTask.status == status)
    total = (await db.execute(count_query)).scalar()

    tasks = (await db.execute(query.limit(limit).offset(offset))).scalars().all()
    return list(tasks), total


async def export_tasks_to_csv(db: AsyncSession) -> str:
    """Export all submitted receipts to CSV matching Bank Tax Automation format."""
    import csv

    # JOIN receipts + details + tasks
    result = await db.execute(
        select(OCRTask, Receipt, ReceiptDetail)
        .join(Receipt, Receipt.task_id == OCRTask.id)
        .join(ReceiptDetail, ReceiptDetail.receipt_id == Receipt.id)
        .where(OCRTask.status == TaskStatus.COMPLETED)
        .order_by(desc(OCRTask.completed_at))
    )
    rows = result.all()

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    csv_path = os.path.join(settings.export_dir, f"ocr_export_{timestamp}.csv")

    headers = [
        "Date Processed (วันที่ระบบอ่าน)",
        "Bank Name",
        "Doc Name",
        "Company Name",
        "Tax ID",
        "Merchant Name",
        "Merchant ID",
        "Account No",
        "Doc Date",
        "Doc No",
        "WHT Rate (%)",
        "WHT Amount",
        "Net Amount",
        "Transaction",
        "Pay Amt",
        "Commis Amt",
        "Tax Amt",
        "Total",
    ]

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for task, receipt, detail in rows:
            writer.writerow([
                task.completed_at.strftime("%m/%d/%Y %H:%M:%S") if task.completed_at else "",
                receipt.bank_name or "",
                receipt.doc_name or "",
                receipt.company_name or "",
                receipt.company_tax_id or "",
                receipt.merchant_name or "",
                receipt.merchant_id or "",
                receipt.account_no or "",
                receipt.doc_date or "",
                receipt.doc_no or "",
                receipt.wht_rate or "",
                receipt.wht_amount or "",
                receipt.net_amount or "",
                detail.transaction or "",
                detail.pay_amt or "",
                detail.commis_amt or "",
                detail.tax_amt or "",
                detail.total or "",
            ])

    logger.info(f"Exported {len(rows)} rows to {csv_path}")
    return csv_path

"""
OCR Service — orchestrates the full pipeline:
  1. Save uploaded file
  2. Pre-process image (resize only — keep colour for vision LLM)
  3. Call OpenRouter vision LLM (OCR + structured extraction in one shot)
  4. Store results in database
"""

import os
import uuid
import logging
from datetime import datetime
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.config import settings
from app.models import OCRTask, TaskStatus
from app.utils.image_processing import preprocess_image, is_valid_image
from app.services.openrouter_ocr import extract_from_image

logger = logging.getLogger(__name__)


async def process_single_file(
    db: AsyncSession,
    file_bytes: bytes,
    original_filename: str,
) -> OCRTask:
    """
    Full pipeline for a single uploaded file:
    save → resize image → OpenRouter vision LLM (OCR + extract) → store.
    """
    # ── 1. Save file ──
    file_id = str(uuid.uuid4())
    ext = os.path.splitext(original_filename)[1].lower()
    saved_filename = f"{file_id}{ext}"
    file_path = os.path.join(settings.upload_dir, saved_filename)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # ── 2. Create task record ──
    task = OCRTask(
        id=file_id,
        filename=saved_filename,
        original_filename=original_filename,
        file_path=file_path,
        status=TaskStatus.PROCESSING,
        ocr_engine=settings.ocr_engine,
    )
    db.add(task)
    await db.flush()

    try:
        # ── 3. Resize image (keep colour — vision LLM benefits from it) ──
        logger.info(f"[{file_id}] Pre-processing image: {original_filename}")
        processed_bytes = preprocess_image(
            file_bytes,
            grayscale=False,
            contrast_factor=1.0,
            sharpness_factor=1.0,
            denoise=False,
        )

        # ── 4. Vision LLM: OCR + structured extraction in one call ──
        logger.info(f"[{file_id}] Calling OpenRouter vision OCR: {settings.openrouter_model}")
        raw_text, extracted = await extract_from_image(processed_bytes, original_filename)

        task.raw_text = raw_text

        # ── 5. Map extracted fields to task record ──
        task.bank_name = extracted.bank_name
        task.doc_name = extracted.doc_name
        task.company_name = extracted.company_name
        task.doc_date = extracted.doc_date
        task.doc_no = extracted.doc_no
        task.terminal_id = extracted.terminal_id
        task.pay_amt = extracted.pay_amt
        task.commis_amt = extracted.commis_amt
        task.tax_amt = extracted.tax_amt
        task.total = extracted.total
        task.wht_amount = extracted.wht_amount

        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.utcnow()

        logger.info(f"[{file_id}] ✅ Completed — Doc: {extracted.doc_no}, Total: {extracted.total}")

    except Exception as e:
        logger.error(f"[{file_id}] ❌ Processing failed: {e}")
        task.status = TaskStatus.FAILED
        task.error_message = str(e)
        task.completed_at = datetime.utcnow()

    return task


async def get_task_by_id(db: AsyncSession, task_id: str) -> Optional[OCRTask]:
    """Retrieve a single task by ID."""
    result = await db.execute(select(OCRTask).where(OCRTask.id == task_id))
    return result.scalar_one_or_none()


async def get_all_tasks(
    db: AsyncSession,
    status: Optional[TaskStatus] = None,
    limit: int = 100,
    offset: int = 0,
) -> tuple[List[OCRTask], int]:
    """
    Retrieve tasks with optional status filter.
    Returns (tasks, total_count).
    """
    query = select(OCRTask)
    if status:
        query = query.where(OCRTask.status == status)
    query = query.order_by(desc(OCRTask.created_at))

    # Count total
    from sqlalchemy import func
    count_query = select(func.count()).select_from(OCRTask)
    if status:
        count_query = count_query.where(OCRTask.status == status)
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    # Fetch page
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    tasks = result.scalars().all()

    return list(tasks), total


async def export_tasks_to_csv(db: AsyncSession) -> str:
    """
    Export all completed tasks to a CSV file matching the Bank Tax Automation format.
    Returns the file path.
    """
    import csv

    tasks, _ = await get_all_tasks(db, status=TaskStatus.COMPLETED, limit=10000)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    csv_filename = f"ocr_export_{timestamp}.csv"
    csv_path = os.path.join(settings.export_dir, csv_filename)

    headers = [
        "Date Processed (วันที่ระบบอ่าน)",
        "Bank Name",
        "Doc Name",
        "Company Name",
        "Doc Date",
        "Doc No",
        "Terminal ID",
        "Pay Amt",
        "Commis Amt",
        "Tax Amt",
        "Total",
        "WHT Amount",
    ]

    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)

        for task in tasks:
            writer.writerow([
                task.completed_at.strftime("%m/%d/%Y %H:%M:%S") if task.completed_at else "",
                task.bank_name or "",
                task.doc_name or "",
                task.company_name or "",
                task.doc_date or "",
                task.doc_no or "",
                task.terminal_id or "",
                task.pay_amt or "",
                task.commis_amt or "",
                task.tax_amt or "",
                task.total or "",
                task.wht_amount or "",
            ])

    logger.info(f"Exported {len(tasks)} records to {csv_path}")
    return csv_path

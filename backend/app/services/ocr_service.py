"""
OCR Service — stateless extraction + task listing/export helpers.
"""

import os
import logging
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.config import settings
from app.models import OCRTask, CreditCard, TaskStatus, ExtractedCreditCardData
from app.utils.image_processing import preprocess_image
from app.services.llm_service import extract_from_image

logger = logging.getLogger(__name__)


async def extract_stateless(
    file_bytes: bytes,
    original_filename: str,
    bank_type: Optional[str] = None,
    hints: Optional[dict] = None,
    task_id: Optional[str] = None,
) -> ExtractedCreditCardData:
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
    _, extracted = await extract_from_image(processed_bytes, original_filename, bank_type, hints=hints, task_id=task_id)
    return extracted


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
    """Export submitted credit card documents to CSV — one row per transaction label."""
    import csv

    result = await db.execute(
        select(OCRTask, CreditCard)
        .join(CreditCard, CreditCard.task_id == OCRTask.id)
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
        "Merchant Name",
        "Doc Date",
        "Doc No",
        "Transaction",
    ]

    written = 0
    with open(csv_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        for task, card in rows:
            transactions = card.transactions or [""]
            for tx in transactions:
                writer.writerow([
                    task.completed_at.strftime("%m/%d/%Y %H:%M:%S") if task.completed_at else "",
                    card.bank_name or "",
                    card.doc_name or "",
                    card.company_name or "",
                    card.merchant_name or "",
                    card.doc_date or "",
                    card.doc_no or "",
                    tx or "",
                ])
                written += 1

    logger.info(f"Exported {written} rows to {csv_path}")
    return csv_path

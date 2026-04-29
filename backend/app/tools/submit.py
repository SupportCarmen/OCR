"""
Tool: submit_receipt

Persists user-confirmed receipt data to the local database.
Duplicate doc_no check is performed at /extract time; submit blocks duplicates as a safeguard.

Usage:
    inp = submit.SubmitInput(bank_type="SCB", ...)
    result = await submit.run(inp, db)
    if result.success:
        receipt_id = result.output["receipt_id"]
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import OCRTask, Receipt, TaskStatus
from app.tools.base import ToolResult

logger = logging.getLogger(__name__)

TOOL_NAME = "submit_receipt"


@dataclass
class SubmitInput:
    """Typed input for the submit_receipt tool (HTTP-layer agnostic)."""
    bank_type: Optional[str]
    original_filename: str
    doc_no: Optional[str]
    doc_date: Optional[str]
    bank_name: Optional[str]
    doc_name: Optional[str]
    company_name: Optional[str]
    merchant_name: Optional[str]
    details: List[Dict[str, Any]] = field(default_factory=list)


async def run(inp: SubmitInput, db: AsyncSession) -> ToolResult:
    """
    Save confirmed receipt data to DB.

    Returns:
        success=True  → output = {receipt_id, doc_no, submitted_at}
        success=False + output = {error: "DUPLICATE_DOC_NO", ...}  → duplicate detected
        success=False + errors   → unexpected failure
    """
    tool_input = {"doc_no": inp.doc_no, "bank_type": inp.bank_type}
    try:
        # 1. Duplicate safeguard (primary check is at /extract time)
        if inp.doc_no:
            dup_result = await db.execute(
                select(Receipt).where(
                    Receipt.doc_no == inp.doc_no,
                    Receipt.submitted_at.isnot(None),
                )
            )
            if dup_result.scalars().first():
                return ToolResult(
                    success=False,
                    tool=TOOL_NAME,
                    input=tool_input,
                    errors=[f"หมายเลขเอกสาร {inp.doc_no} ถูกบันทึกไว้ในระบบแล้ว"],
                )

        # 2. Create OCRTask (record-keeping stub)
        task_id = str(uuid.uuid4())
        task = OCRTask(
            id=task_id,
            original_filename=inp.original_filename or "uploaded_file",
            file_path="STATELESS_MODE",
            status=TaskStatus.COMPLETED,
            ocr_engine=settings.ocr_engine,
            completed_at=datetime.utcnow(),
        )
        db.add(task)
        await db.flush()

        # 3. Create Receipt (header) — only payment-type labels are persisted from details.
        transactions = [
            t for t in (str(item.get("transaction") or "").strip() for item in inp.details)
            if t
        ]
        bt = str(inp.bank_type or "").upper()
        receipt = Receipt(
            task_id=task.id,
            bank_name=inp.bank_name,
            bank_type=bt if bt in ("BBL", "KBANK", "SCB") else None,
            doc_name=inp.doc_name,
            company_name=inp.company_name,
            doc_date=inp.doc_date,
            doc_no=inp.doc_no,
            merchant_name=inp.merchant_name,
            transactions=transactions or None,
            submitted_at=datetime.utcnow(),
        )
        db.add(receipt)
        await db.flush()

        await db.commit()
        logger.info(f"[{TOOL_NAME}] saved doc_no={inp.doc_no}, receipt_id={receipt.id}")

        return ToolResult(
            success=True,
            tool=TOOL_NAME,
            input=tool_input,
            output={
                "receipt_id": receipt.id,
                "doc_no": inp.doc_no,
                "submitted_at": receipt.submitted_at.isoformat(),
            },
            metadata={"task_id": task_id, "transaction_count": len(transactions)},
        )

    except Exception as exc:
        logger.error(f"[{TOOL_NAME}] unexpected error: {exc}", exc_info=True)
        return ToolResult(
            success=False,
            tool=TOOL_NAME,
            input=tool_input,
            errors=[str(exc)],
        )

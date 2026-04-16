"""
Tool: submit_receipt

Persists user-confirmed receipt data to the local database.
Handles duplicate doc_no detection and optional overwrite.

Usage:
    inp = submit.SubmitInput(bank_type="SCB", ...)
    result = await submit.run(inp, db)
    if result.success:
        receipt_id = result.output["receipt_id"]
    elif result.output and result.output.get("error") == "DUPLICATE_DOC_NO":
        # prompt user to confirm overwrite
"""

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import OCRTask, Receipt, ReceiptDetail, TaskStatus
from app.tools.base import ToolResult

logger = logging.getLogger(__name__)

TOOL_NAME = "submit_receipt"


@dataclass
class SubmitInput:
    """Typed input for the submit_receipt tool (HTTP-layer agnostic)."""
    bank_type: Optional[str]
    overwrite: bool
    original_filename: str
    doc_no: Optional[str]
    doc_date: Optional[str]
    bank_name: Optional[str]
    doc_name: Optional[str]
    company_name: Optional[str]
    company_tax_id: Optional[str]
    company_address: Optional[str]
    account_no: Optional[str]
    merchant_name: Optional[str]
    merchant_id: Optional[str]
    wht_rate: Optional[str]
    wht_amount: Optional[float]
    net_amount: Optional[float]
    details: List[Dict[str, Any]] = field(default_factory=list)


async def run(inp: SubmitInput, db: AsyncSession) -> ToolResult:
    """
    Save confirmed receipt data to DB.

    Returns:
        success=True  → output = {receipt_id, doc_no, submitted_at}
        success=False + output = {error: "DUPLICATE_DOC_NO", ...}  → duplicate detected
        success=False + errors   → unexpected failure
    """
    tool_input = {"doc_no": inp.doc_no, "bank_type": inp.bank_type, "overwrite": inp.overwrite}
    try:
        # 1. Duplicate check (submitted receipts only)
        if inp.doc_no:
            dup_result = await db.execute(
                select(Receipt).where(
                    Receipt.doc_no == inp.doc_no,
                    Receipt.submitted_at.isnot(None),
                )
            )
            existing = dup_result.scalars().all()

            if existing:
                if not inp.overwrite:
                    return ToolResult(
                        success=False,
                        tool=TOOL_NAME,
                        input=tool_input,
                        output={
                            "error": "DUPLICATE_DOC_NO",
                            "doc_no": inp.doc_no,
                            "detail": f"หมายเลข {inp.doc_no} ถูกบันทึกไว้ในระบบแล้ว",
                        },
                    )
                # Overwrite: delete old record(s)
                for old in existing:
                    await db.delete(old)
                await db.flush()

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

        # 3. Create Receipt (header)
        bt = str(inp.bank_type or "").upper()
        receipt = Receipt(
            task_id=task.id,
            bank_name=inp.bank_name,
            bank_type=bt if bt in ("BBL", "KBANK", "SCB") else None,
            doc_name=inp.doc_name,
            company_name=inp.company_name,
            company_tax_id=inp.company_tax_id,
            company_address=inp.company_address,
            account_no=inp.account_no,
            doc_date=inp.doc_date,
            doc_no=inp.doc_no,
            merchant_name=inp.merchant_name,
            merchant_id=inp.merchant_id,
            wht_rate=inp.wht_rate,
            wht_amount=inp.wht_amount,
            net_amount=inp.net_amount,
            submitted_at=datetime.utcnow(),
        )
        db.add(receipt)
        await db.flush()

        # 4. Create ReceiptDetail rows
        for item in inp.details:
            db.add(ReceiptDetail(
                receipt_id=receipt.id,
                transaction=item.get("transaction"),
                pay_amt=Decimal(str(item.get("pay_amt") or 0)),
                commis_amt=Decimal(str(item.get("commis_amt") or 0)),
                tax_amt=Decimal(str(item.get("tax_amt") or 0)),
                wht_amount=Decimal(str(item.get("wht_amount") or 0)),
                total=Decimal(str(item.get("total") or 0)),
            ))

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
            metadata={"task_id": task_id, "detail_rows": len(inp.details)},
        )

    except Exception as exc:
        logger.error(f"[{TOOL_NAME}] unexpected error: {exc}", exc_info=True)
        return ToolResult(
            success=False,
            tool=TOOL_NAME,
            input=tool_input,
            errors=[str(exc)],
        )

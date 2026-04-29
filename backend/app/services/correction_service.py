"""
Correction Service — load correction hints for prompt tuning.

Queries correction_feedback + receipts to find fields with high
error rates for a given bank, then returns hint text for the OCR prompt.

Logic:
    error_rate = corrections(field, 90d) / submitted_receipts(bank, 90d)
    hint if error_rate > ERROR_RATE_THRESHOLD
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models import CorrectionFeedback, CreditCard

logger = logging.getLogger(__name__)

# Only hint if error rate exceeds this threshold (10%)
ERROR_RATE_THRESHOLD = 0.10

# Only consider data from the last N days
TTL_DAYS = 90

# Minimum submitted documents required before ratio is meaningful
MIN_CARDS = 10


async def get_correction_hints(
    bank_type: str,
    db: AsyncSession,
) -> dict[str, str]:
    """
    Return {field_name: hint_text} for fields where:
      corrections(field, 90d) / submitted_receipts(bank, 90d) > 10%

    Uses credit_cards table as denominator — corrections are logged at submit time,
    so submitted document count is the correct base for the ratio.

    Only returns field names — no specific corrected values to avoid biasing LLM.
    Tenant isolation is guaranteed by the separate-schema architecture.
    """
    cutoff = datetime.utcnow() - timedelta(days=TTL_DAYS)

    # 1. Count submitted documents for this bank in the last 90 days
    total_result = await db.execute(
        select(func.count())
        .select_from(CreditCard)
        .where(CreditCard.bank_type == bank_type)
        .where(CreditCard.submitted_at.isnot(None))
        .where(CreditCard.submitted_at >= cutoff)
    )
    total_cards = total_result.scalar() or 0

    if total_cards < MIN_CARDS:
        logger.debug(
            f"[hints] {bank_type}: only {total_cards} submitted documents "
            f"(need {MIN_CARDS}) — skipping hints"
        )
        return {}

    # 2. Count corrections per field in the last 90 days
    result = await db.execute(
        select(
            CorrectionFeedback.field_name,
            func.count().label("cnt"),
        )
        .where(CorrectionFeedback.bank_type == bank_type)
        .where(CorrectionFeedback.created_at >= cutoff)
        .group_by(CorrectionFeedback.field_name)
    )
    rows = result.all()

    # 3. Filter by error rate
    hints: dict[str, str] = {}
    for field_name, correction_count in rows:
        error_rate = correction_count / total_cards
        if error_rate >= ERROR_RATE_THRESHOLD:
            hints[field_name] = f"{correction_count}/{total_cards} ({error_rate:.0%})"
            logger.debug(
                f"[hints] {bank_type}.{field_name}: "
                f"{correction_count}/{total_cards} = {error_rate:.0%} → HINT"
            )

    if hints:
        logger.info(
            f"[hints] {bank_type}: {len(hints)} fields above "
            f"{ERROR_RATE_THRESHOLD:.0%} threshold: {list(hints.keys())}"
        )

    return hints

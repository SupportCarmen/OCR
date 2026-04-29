"""Feedback router — log user corrections for learning."""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.database import get_db
from app.models import CorrectionFeedback, CorrectionFeedbackRequest, CorrectionFeedbackResponse
from app.auth.dependencies import get_current_session, SessionInfo

router = APIRouter(prefix="/api/v1/feedback", tags=["feedback"])
logger = logging.getLogger(__name__)


@router.post("/correction", response_model=CorrectionFeedbackResponse)
async def log_correction(
    feedback: CorrectionFeedbackRequest,
    db: AsyncSession = Depends(get_db),
    _session: SessionInfo = Depends(get_current_session),
):
    """
    Log a user correction (called at submit time).

    Uses MySQL INSERT ... ON DUPLICATE KEY UPDATE for atomic UPSERT.
    Skips if value didn't actually change.
    """
    if feedback.original_value == feedback.corrected_value:
        return CorrectionFeedbackResponse(
            id=-1,
            doc_no=feedback.doc_no,
            bank_type=feedback.bank_type,
            field_name=feedback.field_name,
            original_value=feedback.original_value,
            corrected_value=feedback.corrected_value,
            created_at=None,  # type: ignore
        )

    # Atomic UPSERT — avoids SELECT + INSERT race condition with MySQL REPEATABLE READ
    stmt = (
        mysql_insert(CorrectionFeedback)
        .values(
            doc_no=feedback.doc_no,
            bank_type=feedback.bank_type,
            field_name=feedback.field_name,
            original_value=feedback.original_value,
            corrected_value=feedback.corrected_value,
            user_id=_session.user_id or None,
        )
        .on_duplicate_key_update(
            bank_type=feedback.bank_type,
            original_value=feedback.original_value,
            corrected_value=feedback.corrected_value,
            user_id=_session.user_id or None,
        )
    )
    await db.execute(stmt)
    await db.commit()

    # Fetch back the full record — tenant isolation is guaranteed by separate-schema DB
    result = await db.execute(
        select(CorrectionFeedback).where(
            CorrectionFeedback.doc_no == feedback.doc_no,
            CorrectionFeedback.field_name == feedback.field_name,
        )
    )
    record = result.scalar_one()

    logger.info("✓ Upserted correction: %s (%s)", feedback.field_name, feedback.bank_type)
    logger.debug("  original='%s' → corrected='%s'", feedback.original_value, feedback.corrected_value)

    return CorrectionFeedbackResponse.model_validate(record)

"""
Audit Log Service — fire-and-forget user activity logging.

Usage in route handlers:
    from app.services.audit_service import log_action
    await log_action(session, action="EXTRACT", resource="CREDIT_CARD",
                     document_ref=filename, ip_address=request.client.host)
"""

import logging
from typing import Optional

from app.database import async_session
from app.models.orm import AuditLog
from app.auth.session import SessionInfo
from app.context import current_session_id, current_document_ref

logger = logging.getLogger(__name__)

# ── Action constants ──────────────────────────────────────────────────────────
EXTRACT    = "EXTRACT"
SUBMIT     = "SUBMIT"
SUGGEST_GL = "SUGGEST_GL"
EXPORT     = "EXPORT"
LOGIN      = "LOGIN"
LOGOUT     = "LOGOUT"

# ── Resource constants ────────────────────────────────────────────────────────
CREDIT_CARD = "CREDIT_CARD"
AP_INVOICE  = "AP_INVOICE"


async def log_action(
    session: SessionInfo,
    action: str,
    resource: Optional[str] = None,
    document_ref: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    """
    Persist one audit record asynchronously.
    Never raises — logging must not interrupt the main flow.
    """
    try:
        async with async_session() as db:
            db.add(AuditLog(
                tenant=session.tenant,
                session_id=current_session_id.get() or None,
                user_id=session.user_id,
                username=session.username,
                bu=session.bu,
                action=action,
                resource=resource,
                document_ref=document_ref or current_document_ref.get() or None,
                ip_address=ip_address,
            ))
            await db.commit()
    except Exception as exc:
        logger.error("audit_service.log_action failed: %s", exc)

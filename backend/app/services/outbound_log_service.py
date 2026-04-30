"""
Outbound Call Log Service — records every HTTP call to external services.

Proves that data only leaves the system via approved destinations:
  - openrouter.ai  (LLM vision + suggestion calls)
  - dev.carmen4.com (Carmen Cloud proxy calls)

Usage:
    await log_outbound(service="openrouter", url="...", method="POST",
                       status_code=200, duration_ms=1240, request_size_bytes=45000)
"""

import logging
from typing import Optional

from app.database import async_session
from app.models.orm import OutboundCallLog
from app.context import current_session_id, current_user_id

logger = logging.getLogger(__name__)


async def log_outbound(
    service: str,
    url: str,
    method: str = "POST",
    status_code: Optional[int] = None,
    duration_ms: Optional[float] = None,
    request_size_bytes: Optional[int] = None,
) -> None:
    """
    Persist one outbound-call record asynchronously.
    Reads session/user from request context vars — no extra params needed.
    Never raises.
    """
    try:
        async with async_session() as db:
            db.add(OutboundCallLog(
                service=service,
                url=url,
                method=method,
                status_code=status_code,
                duration_ms=duration_ms,
                request_size_bytes=request_size_bytes,
                session_id=current_session_id.get() or None,
                user_id=current_user_id.get() or None,
            ))
            await db.commit()
    except Exception as exc:
        logger.error("outbound_log_service.log_outbound failed: %s", exc)

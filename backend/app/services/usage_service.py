import logging
from typing import Optional
from app.database import async_session
from app.models.orm import LLMUsageLog

logger = logging.getLogger(__name__)


async def log_llm_usage(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    task_id: Optional[str] = None,
    usage_type: Optional[str] = None,
    bu_name: Optional[str] = None,  # fallback if context var not set
) -> None:
    """
    Record LLM token usage.  session_id / user_id / bu_name are read automatically
    from request context vars so callers don't need to pass them.
    Never raises — logging must not interrupt the main flow.
    """
    from app.context import current_session_id, current_user_id, current_bu, current_tenant

    try:
        async with async_session() as db:
            db.add(LLMUsageLog(
                task_id=task_id,
                usage_type=usage_type,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                session_id=current_session_id.get() or None,
                user_id=current_user_id.get() or None,
                bu_name=current_bu.get() or bu_name or None,
                tenant=current_tenant.get() or None,
            ))
            await db.commit()
            logger.debug("LLM usage logged: %s %s tokens session=%s",
                         model, total_tokens, current_session_id.get())
    except Exception as e:
        logger.error("Failed to log LLM usage: %s", e)

import hashlib
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import async_session
from app.models.orm import LLMUsageLog

logger = logging.getLogger(__name__)


def _hash_token(token: str) -> str:
    """Return SHA-256 hex digest of a token (64 chars)."""
    return hashlib.sha256(token.encode()).hexdigest()


async def log_llm_usage(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    task_id: Optional[str] = None,
    usage_type: Optional[str] = None,
    admin_token: Optional[str] = None,  # raw token — stored as SHA-256 hash
    bu_name: Optional[str] = None,
):
    """
    Asynchronously record LLM token usage to the database.
    Does not raise exceptions to ensure OCR/Processing doesn't fail due to logging errors.
    """
    try:
        async with async_session() as db:
            log_entry = LLMUsageLog(
                task_id=task_id,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                usage_type=usage_type,
                token_hash=_hash_token(admin_token) if admin_token else None,
                bu_name=bu_name,
            )
            db.add(log_entry)
            await db.commit()
            logger.debug(f"Logged LLM usage: {model}, {total_tokens} tokens, bu={bu_name}")
    except Exception as e:
        logger.error(f"Failed to log LLM usage: {e}")

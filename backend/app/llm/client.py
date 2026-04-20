"""
LLM Client Factory — shared AsyncOpenAI client + text completion helper.

All modules that need to talk to OpenRouter should use these helpers
instead of constructing AsyncOpenAI directly.
"""

import json
import logging
from typing import Optional

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)


def get_client() -> AsyncOpenAI:
    """Return a new AsyncOpenAI client configured for OpenRouter."""
    return AsyncOpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
    )


async def call_text_llm(
    prompt: str,
    model: Optional[str] = None,
    task_id: Optional[str] = None,
    usage_type: Optional[str] = None
) -> Optional[dict]:
    """
    Call the text/suggestion LLM with a single user prompt.

    Strips markdown code fences if present, then parses JSON.
    Returns None on any failure (no exceptions raised to callers).

    Uses settings.openrouter_suggestion_model by default.
    """
    from app.services.usage_service import log_llm_usage
    import asyncio

    client = get_client()
    target_model = model or settings.openrouter_suggestion_model
    response = await client.chat.completions.create(
        model=target_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=2048,
    )

    # Log usage in the background
    if response.usage:
        asyncio.create_task(log_llm_usage(
            model=target_model,
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            task_id=task_id,
            usage_type=usage_type
        ))

    content = (
        response.choices[0].message.content
        if response.choices and response.choices[0].message
        else None
    )
    if not content:
        return None

    raw = content.strip()
    if raw.startswith("```"):
        lines = raw.split("\n")
        if len(lines) > 1:
            last = lines[-1].strip()
            raw = "\n".join(lines[1:-1] if last == "```" else lines[1:]).strip()

    try:
        return json.loads(raw)
    except Exception:
        logger.error(f"Failed to parse LLM JSON: {raw[:200]}")
        return None

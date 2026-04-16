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


async def call_text_llm(prompt: str, model: Optional[str] = None) -> Optional[dict]:
    """
    Call the text/suggestion LLM with a single user prompt.

    Strips markdown code fences if present, then parses JSON.
    Returns None on any failure (no exceptions raised to callers).

    Uses settings.openrouter_suggestion_model by default.
    """
    client = get_client()
    response = await client.chat.completions.create(
        model=model or settings.openrouter_suggestion_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=2048,
    )
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

    return json.loads(raw)

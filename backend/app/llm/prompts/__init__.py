"""
OCR prompt registry.

Usage:
    from app.llm.prompts import get_ocr_prompt
    prompt = get_ocr_prompt("SCB")   # or "BBL", "KBANK", None → generic
"""

from app.llm.prompts.scb import PROMPT as _SCB
from app.llm.prompts.bbl import PROMPT as _BBL
from app.llm.prompts.kbank import PROMPT as _KBANK
from app.llm.prompts.generic import PROMPT as _GENERIC

_REGISTRY: dict[str, str] = {
    "SCB": _SCB,
    "BBL": _BBL,
    "KBANK": _KBANK,
}


def get_ocr_prompt(bank_type: str | None) -> str:
    """Return the bank-specific OCR prompt, falling back to generic."""
    return _REGISTRY.get(bank_type or "", _GENERIC)

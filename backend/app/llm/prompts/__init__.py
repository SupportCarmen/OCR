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
    "SCB":   _SCB,
    "BBL":   _BBL,
    "KBANK": _KBANK,
}

# Bump the version string whenever a prompt changes — used by GET /api/version
_PROMPT_VERSIONS: dict[str, str] = {
    "SCB":    "1.0.0",
    "BBL":    "1.0.0",
    "KBANK":  "1.0.0",
    "GENERIC":"1.0.0",
}


def get_ocr_prompt(bank_type: str | None, hints: dict[str, str] | None = None) -> str:
    """Return the bank-specific OCR prompt, falling back to generic.

    hints: {field_name: error_rate_info} from correction_service.
           When provided, a warning section is appended telling LLM
           which fields are often extracted incorrectly (no specific values).
    """
    base_prompt = _REGISTRY.get(bank_type or "", _GENERIC)
    if not hints:
        return base_prompt

    hint_lines = "\n".join(
        f"- {field}: often extracted incorrectly — read the document carefully for this field"
        for field in hints.keys()
    )
    return (
        base_prompt
        + f"\n\n⚠️ CORRECTION NOTES (fields that are often wrong for {bank_type}):\n"
        + hint_lines
    )

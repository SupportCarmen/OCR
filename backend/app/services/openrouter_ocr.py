"""
OpenRouter Vision OCR Service.

Sends an image directly to a multimodal LLM via OpenRouter for
simultaneous OCR + structured data extraction in a single API call.

Supported models (set OPENROUTER_MODEL in .env):
  - google/gemini-2.5-flash-preview  (fast, accurate on Thai text)
  - google/gemini-2.0-flash-001
  - anthropic/claude-3.5-sonnet
  - openai/gpt-4o
"""

import base64
import json
import logging
import os
from typing import Optional, Tuple

from app.config import settings
from app.llm.client import get_client
from app.llm.prompts import get_ocr_prompt
from app.models import ExtractedReceiptData

logger = logging.getLogger(__name__)

# Fields that map to ExtractedReceiptData
_RECEIPT_FIELDS = set(ExtractedReceiptData.model_fields.keys())


def _get_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".tif": "image/tiff",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }.get(ext, "image/png")


async def extract_from_image(
    image_bytes: bytes,
    filename: str = "receipt.png",
    bank_type: Optional[str] = None,
    hints: Optional[dict] = None,
) -> Tuple[str, ExtractedReceiptData]:
    """
    Send an image to OpenRouter vision LLM and return:
      (raw_text, ExtractedReceiptData)

    bank_type: "SCB" | "BBL" | "KBANK" — selects bank-specific prompt.
    hints: correction hints from correction_feedback (appended to prompt).
    Raises on API or JSON parse failure — let the caller handle errors.
    """
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    client = get_client()
    prompt = get_ocr_prompt(bank_type, hints=hints)

    mime_type = _get_mime_type(filename)
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_image}"

    logger.info(f"Calling OpenRouter model={settings.openrouter_ocr_model} bank={bank_type or 'generic'}")

    response = await client.chat.completions.create(
        model=settings.openrouter_ocr_model,
        messages=[
            {
                "role": "system",
                "content": prompt,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": data_url},
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract all detail rows from this document following the system instructions exactly. "
                            "Each merchant number row = one separate object in details[]. "
                            "Output valid JSON only, no explanation."
                        ),
                    },
                ],
            },
        ],
        temperature=0.0,
        max_tokens=8192,
    )

    raw_content = response.choices[0].message.content if (response.choices and response.choices[0].message) else None
    if raw_content is None:
        raise ValueError("LLM returned None content — model may have hit token limit or safety filter")

    result_text = raw_content.strip()
    if not result_text:
        raise ValueError("LLM returned empty string from vision model")

    logger.info(f"Raw LLM response:\n{result_text[:1000]}")

    # Save last raw response for debug endpoint (Windows-compatible)
    import pathlib, tempfile
    pathlib.Path(tempfile.gettempdir()).joinpath("last_llm_response.txt").write_text(result_text, encoding="utf-8")

    # Strip markdown code fences if model wraps response
    if result_text.startswith("```"):
        lines = result_text.split("\n")
        if len(lines) > 1:
            last_line = lines[-1].strip()
            result_text = "\n".join(lines[1:-1] if last_line == "```" else lines[1:])
            result_text = result_text.strip()

    data: dict = json.loads(result_text)

    raw_text: str = data.pop("raw_text", "") or ""

    # Only pass known fields to ExtractedReceiptData
    extracted = ExtractedReceiptData(**{k: v for k, v in data.items() if k in _RECEIPT_FIELDS})

    # Post-process: remove rows with zero or null pay_amt.
    def _is_zero(v: Optional[str]) -> bool:
        if v is None:
            return True
        try:
            return float(v.replace(",", "")) == 0
        except ValueError:
            return False

    extracted.details = [r for r in extracted.details if not _is_zero(r.pay_amt)]

    n_details = len(extracted.details)
    total_sample = extracted.details[0].total if n_details else "—"
    logger.info(
        f"Vision OCR extracted — doc_no={extracted.doc_no}, "
        f"bank={extracted.bank_name}, details={n_details} rows, first_total={total_sample}"
    )

    return raw_text, extracted

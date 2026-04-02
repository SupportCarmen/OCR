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
from typing import Tuple

from openai import AsyncOpenAI

from app.config import settings
from app.models import ExtractedReceiptData

logger = logging.getLogger(__name__)

# Fields that map to ExtractedReceiptData
_RECEIPT_FIELDS = set(ExtractedReceiptData.model_fields.keys())

VISION_PROMPT = """You are a document data extractor specialized in Thai bank receipts and tax invoices (ใบเสร็จรับเงิน/ใบกำกับภาษี).

Carefully read all text visible in the image and extract the following fields into a JSON object.
If a field is not present, set it to null.
For monetary amounts, preserve the original format including commas (e.g. "88,911.00").

Fields to extract:
- bank_name: ชื่อธนาคาร (e.g. "Bangkok Bank", "Bangkok Bank Public Company Limited")
- doc_name: ประเภทเอกสาร (e.g. "ใบเสร็จรับเงิน/ใบกำกับภาษี")
- company_name: ชื่อบริษัท/ร้านค้า (e.g. "THE ICONIC BANGNA CO.,LTD")
- doc_date: วันที่เอกสาร in DD/MM/YYYY format
- doc_no: เลขที่เอกสาร (e.g. "25251-01-00193")
- terminal_id: Terminal ID / Merchant ID (may include card network label like "Visa"/"Master")
- pay_amt: ยอดชำระ Payment Amount
- commis_amt: ค่าธรรมเนียม Commission Amount
- tax_amt: ภาษีมูลค่าเพิ่ม VAT Amount
- total: ยอดรวมสุทธิ Net Total (after deducting commission)
- wht_amount: ภาษีหัก ณ ที่จ่าย Withholding Tax (if present, else null)
- raw_text: Full verbatim text visible in the document (all lines, used for audit)

Return ONLY a valid JSON object — no markdown fences, no explanation."""


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
) -> Tuple[str, ExtractedReceiptData]:
    """
    Send an image to OpenRouter vision LLM and return:
      (raw_text, ExtractedReceiptData)

    Raises on API or JSON parse failure — let the caller handle errors.
    """
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    client = AsyncOpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
    )

    mime_type = _get_mime_type(filename)
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_image}"

    logger.info(f"Calling OpenRouter model={settings.openrouter_model} for vision OCR")

    response = await client.chat.completions.create(
        model=settings.openrouter_model,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": data_url},
                    },
                    {
                        "type": "text",
                        "text": VISION_PROMPT,
                    },
                ],
            }
        ],
        temperature=0.0,
        max_tokens=2000,
    )

    result_text = response.choices[0].message.content.strip()
    logger.debug(f"Raw LLM response: {result_text[:300]}")

    # Strip markdown code fences if model wraps response
    if result_text.startswith("```"):
        lines = result_text.split("\n")
        # Remove first line (```json or ```) and last line (```)
        result_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        result_text = result_text.strip()

    data: dict = json.loads(result_text)

    raw_text: str = data.pop("raw_text", "") or ""

    # Only pass known fields to ExtractedReceiptData
    extracted = ExtractedReceiptData(**{k: v for k, v in data.items() if k in _RECEIPT_FIELDS})

    logger.info(
        f"Vision OCR extracted — doc_no={extracted.doc_no}, "
        f"bank={extracted.bank_name}, total={extracted.total}"
    )

    return raw_text, extracted

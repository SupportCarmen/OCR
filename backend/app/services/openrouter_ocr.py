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

from openai import AsyncOpenAI

from app.config import settings
from app.models import ExtractedReceiptData

logger = logging.getLogger(__name__)

# Fields that map to ExtractedReceiptData
_RECEIPT_FIELDS = set(ExtractedReceiptData.model_fields.keys())

# ── Shared row-extraction rules (applied in all bank prompts) ─────────────────
_ROW_RULES = """
Rules for extracting details[] rows:
1. A row QUALIFIES as a detail row ONLY IF it has a terminal_id (merchant number / หมายเลขร้านค้า / Merchant ID / Terminal ID). Rows without a terminal_id are NOT detail rows.
2. Include every qualifying row — there is no fixed number of rows.
3. SKIP rows labeled: จำนวนเงินรวม, TOTAL, รวม, GRAND TOTAL, NET AMOUNT, จำนวนเงินค่าธรรมเนียม — these are summary/aggregate rows, NOT detail rows.
4. SKIP rows where ALL amount fields are 0.00 or blank.
5. wht_amount (ภาษีหัก ณ ที่จ่าย / Withholding Tax) is a document-level value:
   - If there is only ONE detail row → put wht_amount on that row.
   - If there are MULTIPLE detail rows → set wht_amount = null on all rows except the LAST, which gets the document WHT value.
   - If WHT is not present anywhere in the document → set wht_amount = null on all rows.
"""

# ── Shared output format ──────────────────────────────────────────────────────
_OUTPUT_RULES = """
Return ONLY a valid JSON object — no markdown fences, no explanation.
If a header field is not present in the document, set it to null.
For monetary amounts, preserve the original format with commas (e.g. "10,342.12").
For doc_date, always convert to DD/MM/YYYY format.

CRITICAL: Each payment row in the document = ONE separate JSON object inside the "details" array.
Do NOT merge multiple rows into one object. Do NOT put multiple transactions in one transaction field.

Example — if the document has 2 payment rows (Visa + Master):
{
  "bank_name":    "Bangkok Bank",
  "doc_name":     "ใบเสร็จรับเงิน/ใบกำกับภาษี",
  "company_name": "COMPANY NAME CO.,LTD",
  "doc_date":     "09/09/2025",
  "doc_no":       "25251-01-01485",
  "details": [
    {
      "transaction": "002206198772 (Visa)",
      "pay_amt":     "5,407.00",
      "commis_amt":  "136.48",
      "tax_amt":     "9.55",
      "total":       "5,260.97",
      "wht_amount":  null
    },
    {
      "transaction": "002206244147 (Master)",
      "pay_amt":     "24,176.52",
      "commis_amt":  "725.29",
      "tax_amt":     "50.77",
      "total":       "23,400.46",
      "wht_amount":  "25.85"
    }
  ],
  "raw_text": "Full verbatim text of entire document, all lines"
}

If the document has only 1 payment row, details[] has 1 object. If 3 rows, details[] has 3 objects. Always one object per payment row.
"""

# ── SCB ──────────────────────────────────────────────────────────────────────
VISION_PROMPT_SCB = """You are extracting structured data from an SCB (ธนาคารไทยพาณิชย์) credit card summary receipt.

Document layout:
- Title: "ใบนำฝากเงิน/ใบสรุปยอดขายบัตรเครดิต/ใบกำกับภาษี"
- Top-right header block:
    "เลขที่" → doc_no
    "รายการประจำวันที่" → doc_date
- MERCHANT NUMBER and MERCHANT NAME → company_name (not needed as transaction)
- Main table has card-type rows (VSA-DCC-P, VSA-INT-P, MCA-INT, JCB, etc.)
  Columns: CARD TYPE | S/D AMOUNT | DISCOUNT AMOUNT | VALUE ADDED TAX | AMOUNT CREDIT TO MERCHANT
  Map columns:  CARD TYPE → transaction | S/D AMOUNT → pay_amt | DISCOUNT AMOUNT → commis_amt | VALUE ADDED TAX → tax_amt | AMOUNT CREDIT TO MERCHANT → total
- "WITHHOLDING TAX = X.XX" at the bottom → wht_amount (document-level)
""" + _ROW_RULES + _OUTPUT_RULES

# ── BBL ──────────────────────────────────────────────────────────────────────
VISION_PROMPT_BBL = """You are extracting structured data from a Bangkok Bank (ธนาคารกรุงเทพ / BBL) receipt and tax invoice.

Document layout:
- Title: "ใบเสร็จรับเงิน/ใบกำกับภาษี"
- Left side: company name after "ชื่อ :" → company_name
- Right side:
    "วันที่" → doc_date
    "เลขที่" → doc_no  (format: XXXXX-XX-XXXXX e.g. 25251-01-01485)
- Main data table has these columns:
    หมายเลขร้านค้า | จำนวนเงิน | ค่าธรรมเนียม | ภาษีมูลค่าเพิ่ม | จำนวนเงินสุทธิ
    Map to:        transaction pay_amt        commis_amt         tax_amt            total
- "ภาษีหัก ณ ที่จ่าย X.XX %" followed by baht amount → wht_amount (document-level)

HOW TO EXTRACT ROWS — read carefully:
- Look at the หมายเลขร้านค้า column. Each cell that contains a merchant number is ONE detail row.
- The transaction field should contain: merchant_number + any handwritten card-type label (e.g. "Visa", "Master").
  Example: if you see "002206198772" with handwritten "Visa" next to it → transaction = "002206198772 (Visa)"
  Example: if you see "002206244147" with handwritten "Master" → transaction = "002206244147 (Master)"
  If no handwritten label → transaction = just the numeric code "002206198772"
- If the table has 2 merchant number rows, output 2 detail entries. If 3, output 3. Count the actual merchant number rows.
- The "จำนวนเงินรวม" row at the bottom is a TOTAL/SUMMARY — do NOT include it as a detail row.
""" + _ROW_RULES + _OUTPUT_RULES

# ── KBANK ─────────────────────────────────────────────────────────────────────
VISION_PROMPT_KBANK = """You are extracting structured data from a KBANK (ธนาคารกสิกรไทย / Kasikornbank) receipt and tax invoice.

Document layout:
- Title: "ใบเสร็จรับเงิน / ใบกำกับภาษี" / "RECEIPT / TAX INVOICE"
- Top-right box:
    "วันที่ออกเอกสาร / Issued Date"    → doc_date
    "เลขที่เอกสาร / Document number"   → doc_no  (alphanumeric e.g. 311225E00032857)
- "รหัสร้านค้า / MERCHANT ID"          → company_name (not needed separately)
- "ชื่อร้านค้า / MERCHANT NAME"        → company_name
- Main table columns:
    ประเภทการชำระ / PAYMENT TYPE       → transaction
    ยอดเงิน / AMOUNT                   → pay_amt
    ค่าธรรมเนียม / FEE/COMMISSION AMOUNT → commis_amt
    ภาษีมูลค่าเพิ่ม / VAT (7.00%)      → tax_amt
    ยอดเงินสุทธิ / NET AMOUNT           → total
- wht_amount: NOT a labeled field — search the body text paragraph for
  "WITHHOLDING TAX OF X.XX BAHT" or "ภาษีหัก ณ ที่จ่าย ... จำนวน X.XX บาท"
  Extract only the numeric baht amount (e.g. "12.18"). This is the document-level WHT.
""" + _ROW_RULES + _OUTPUT_RULES

# ── Generic fallback ──────────────────────────────────────────────────────────
VISION_PROMPT_GENERIC = """You are a document data extractor specialized in Thai bank receipts and tax invoices (ใบเสร็จรับเงิน/ใบกำกับภาษี).

Carefully read all text in the image. Identify the data table and extract structured data.
""" + _ROW_RULES + _OUTPUT_RULES

_BANK_PROMPTS: dict[str, str] = {
    "SCB": VISION_PROMPT_SCB,
    "BBL": VISION_PROMPT_BBL,
    "KBANK": VISION_PROMPT_KBANK,
}


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
) -> Tuple[str, ExtractedReceiptData]:
    """
    Send an image to OpenRouter vision LLM and return:
      (raw_text, ExtractedReceiptData)

    bank_type: "SCB" | "BBL" | "KBANK" — selects bank-specific prompt.
    Raises on API or JSON parse failure — let the caller handle errors.
    """
    if not settings.openrouter_api_key:
        raise ValueError("OPENROUTER_API_KEY is not configured")

    client = AsyncOpenAI(
        api_key=settings.openrouter_api_key,
        base_url=settings.openrouter_base_url,
    )

    prompt = _BANK_PROMPTS.get(bank_type or "", VISION_PROMPT_GENERIC)

    mime_type = _get_mime_type(filename)
    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_image}"

    logger.info(f"Calling OpenRouter model={settings.openrouter_model} bank={bank_type or 'generic'}")

    response = await client.chat.completions.create(
        model=settings.openrouter_model,
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
        max_tokens=4096,
    )

    result_text = response.choices[0].message.content.strip()
    logger.info(f"Raw LLM response:\n{result_text[:1000]}")
    print(f"\n{'='*60}\nRAW LLM RESPONSE:\n{result_text}\n{'='*60}\n", flush=True)

    # Save last raw response for debug endpoint (Windows-compatible)
    import pathlib, tempfile
    pathlib.Path(tempfile.gettempdir()).joinpath("last_llm_response.txt").write_text(result_text, encoding="utf-8")

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

    n_details = len(extracted.details)
    total_sample = extracted.details[0].total if n_details else "—"
    logger.info(
        f"Vision OCR extracted — doc_no={extracted.doc_no}, "
        f"bank={extracted.bank_name}, details={n_details} rows, first_total={total_sample}"
    )

    return raw_text, extracted

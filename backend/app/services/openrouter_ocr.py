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
1. Include every card/payment type row that has a non-zero pay_amt.
2. SKIP rows labeled: จำนวนเงินรวม, TOTAL, รวม, GRAND TOTAL, NET AMOUNT, จำนวนเงินค่าธรรมเนียม — summary rows only.
3. SKIP rows where pay_amt is 0.00 or blank.
4. wht_amount is a document-level header field — do NOT put it inside any detail row.
"""

# ── Shared output format ──────────────────────────────────────────────────────
_OUTPUT_RULES = """
Return ONLY a valid JSON object — no markdown fences, no explanation.
If a field is not present in the document, set it to null.
For monetary amounts, preserve the original format with commas (e.g. "10,342.12").
For doc_date, always convert to DD/MM/YYYY format.

CRITICAL: Each payment/card type row = ONE separate JSON object inside the "details" array.
Do NOT merge multiple rows into one object.

Header fields to extract:
- bank_name        : ชื่อธนาคารภาษาไทยเต็มๆ เท่านั้น — ใช้ค่าที่กำหนดตายตัวตามธนาคาร:
                     SCB   → "ธนาคารไทยพาณิชย์"
                     BBL   → "ธนาคารกรุงเทพ"
                     KBANK → "ธนาคารกสิกรไทย"
                     ห้ามใส่ชื่อภาษาอังกฤษหรือตัวย่อ
- doc_name         : document title (e.g. "ใบเสร็จรับเงิน/ใบกำกับภาษี")
- company_name     : company name from address section (ชื่อ / NAME)
- company_tax_id   : merchant tax ID (เลขประจำตัวผู้เสียภาษี / TAX ID) — digits only, no label
- company_address  : merchant full address (ที่อยู่ / ADDRESS)
- account_no       : bank account number the money is deposited into (เลขที่บัญชี / ACCOUNT NO)
- doc_date         : document date → DD/MM/YYYY
- doc_no           : document number
- merchant_name    : MERCHANT NAME as shown in the merchant section (e.g. "KIMBERLY CO.LTD.", "บ.ปุรณาการ จก.")
- merchant_id      : MERCHANT NUMBER / MERCHANT ID / หมายเลขร้านค้า / รหัสร้านค้า — numeric code only (e.g. "010000000003468916")
- wht_rate         : withholding tax RATE as percentage string — look for patterns like
                     "ภาษีหัก ณ ที่จ่าย 3.00 %" / "อัตรา 3%" / "WITHHOLDING TAX ... 3.00%" / "หักภาษีในอัตรา 3%"
                     Extract only the number e.g. "3.00" — do NOT leave null if any rate pattern is found
- wht_amount       : withholding tax BAHT AMOUNT for the entire document (ภาษีหัก ณ ที่จ่าย / WITHHOLDING TAX)
                     e.g. "WITHHOLDING TAX = 12.73" → "12.73". Document-level field only.
- net_amount       : document-level NET AMOUNT / ยอดเงินสุทธิรวม (the grand total after WHT deduction)
                     e.g. "NET AMOUNT = 14,105.89" → "14,105.89". Null if not shown.

Detail row fields (one object per card/payment type row):
- transaction  : card type / payment type label (e.g. "Visa", "Master", "VSA-INT-P", "บัตรเครดิต/เดบิต") — null if not labeled
- pay_amt      : gross sale amount (S/D AMOUNT / ยอดเงิน / จำนวนเงิน)
- commis_amt   : commission / discount fee (DISCOUNT AMOUNT / ค่าธรรมเนียม)
- tax_amt      : VAT on commission (VALUE ADDED TAX / ภาษีมูลค่าเพิ่ม)
- total        : net amount credited to merchant per row (AMOUNT CREDIT TO MERCHANT / จำนวนเงินสุทธิ)

Example — document with 2 payment rows:
{
  "bank_name":       "ธนาคารกรุงเทพ",
  "doc_name":        "ใบเสร็จรับเงิน/ใบกำกับภาษี",
  "company_name":    "บริษัท COMPANY NAME จำกัด",
  "company_tax_id":  "0105555181506",
  "company_address": "89 ซอยสุขุมวิท 2 แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110",
  "account_no":      "206-0-90244-8",
  "doc_date":        "09/09/2025",
  "doc_no":          "25251-01-01485",
  "merchant_name":   "COMPANY NAME CO.,LTD",
  "merchant_id":     "002206198772",
  "wht_rate":        "3.00",
  "wht_amount":      "25.85",
  "net_amount":      "28,636.58",
  "details": [
    {
      "transaction":  "Visa",
      "pay_amt":      "5,407.00",
      "commis_amt":   "136.48",
      "tax_amt":      "9.55",
      "total":        "5,260.97"
    },
    {
      "transaction":  "Master",
      "pay_amt":      "24,176.52",
      "commis_amt":   "725.29",
      "tax_amt":      "50.77",
      "total":        "23,400.46"
    }
  ]
}
"""

# ── SCB ──────────────────────────────────────────────────────────────────────
VISION_PROMPT_SCB = """You are extracting structured data from an SCB (ธนาคารไทยพาณิชย์) credit card summary receipt.

IMPORTANT: bank_name must always be exactly "ธนาคารไทยพาณิชย์" — no English, no abbreviation.

Document layout:
- Title: "ใบนำฝากเงิน/ใบสรุปยอดขายบัตรเครดิต/ใบกำกับภาษี"
- "เลขที่"                → doc_no
- "รายการประจำวันที่"      → doc_date (→ DD/MM/YYYY)
- "MERCHANT NUMBER"       → merchant_id (header field)
- "MERCHANT NAME"         → merchant_name (header field)
- "NAME" (address section) → company_name
- "TAX ID" or tax number  → company_tax_id (digits only)
- "ACCOUNT NO" or A/C NO  → account_no
- "WITHHOLDING TAX = X.XX" → wht_amount (document-level header field)
- "NET AMOUNT = X.XX"     → net_amount (document-level grand total)
- wht_rate: look for "อัตรา 3.00%" or "3.00%" near the WHT sentence → extract "3.00"

Main table columns:
  CARD TYPE | S/D AMOUNT | DISCOUNT AMOUNT | VALUE ADDED TAX | AMOUNT CREDIT TO MERCHANT
  → transaction  pay_amt    commis_amt         tax_amt           total

CRITICAL FOR SCB:
1. Scan the ENTIRE table top to bottom — collect ALL rows where pay_amt > 0.
2. Do NOT stop scanning after finding a row — continue to end of table.
3. Example rows to include: VSA-INT-P, VSA-INT, MCA-INT-P, MCA-INT — any CARD TYPE with pay_amt > 0.
""" + _ROW_RULES + _OUTPUT_RULES

# ── BBL ──────────────────────────────────────────────────────────────────────
VISION_PROMPT_BBL = """You are extracting structured data from a Bangkok Bank (ธนาคารกรุงเทพ / BBL) receipt and tax invoice.

IMPORTANT: bank_name must always be exactly "ธนาคารกรุงเทพ" — no English, no abbreviation.

Document layout:
- Title: "ใบเสร็จรับเงิน/ใบกำกับภาษี"
- "ชื่อ :"          → company_name
- "ที่อยู่ :"        → company_address
- "เลขประจำตัวผู้เสียภาษี :" → company_tax_id (digits only)
- "เลขที่บัญชี :"   → account_no
- "วันที่ :"        → doc_date (→ DD/MM/YYYY)
- "เลขที่ :"        → doc_no  (e.g. 25251-01-01485)
- "ภาษีหัก ณ ที่จ่าย X.XX %" → wht_rate = "X.XX" AND the baht amount → wht_amount (document-level header field)
- หมายเลขร้านค้า (numeric code in table) → merchant_id (header field)
- merchant_name: same as company_name for BBL (no separate merchant name field)

Main data table columns:
    หมายเลขร้านค้า | จำนวนเงิน | ค่าธรรมเนียม | ภาษีมูลค่าเพิ่ม | จำนวนเงินสุทธิ
    → transaction      pay_amt      commis_amt      tax_amt           total

HOW TO EXTRACT ROWS:
- Each numeric merchant code row = ONE detail row.
- transaction = the merchant number (หมายเลขร้านค้า) from that row — BBL does NOT label card types separately, so use the merchant number as the transaction label.
- "จำนวนเงินรวม" is a TOTAL row — do NOT include as a detail row.
- The WHT baht amount below the total row is NOT a detail row — it goes to wht_amount header field.

net_amount for BBL:
- Look for the total in the "จำนวนเงินสุทธิ" column of the "จำนวนเงินรวม" summary row.
- This is the grand total of all net amounts — use it as net_amount.
- If there is only one detail row, net_amount = that row's "จำนวนเงินสุทธิ" value.
- net_amount must NOT be null — always extract it from the summary row or single row.
""" + _ROW_RULES + _OUTPUT_RULES

# ── KBANK ─────────────────────────────────────────────────────────────────────
VISION_PROMPT_KBANK = """You are extracting structured data from a KBANK (ธนาคารกสิกรไทย / Kasikornbank) receipt and tax invoice.

IMPORTANT: bank_name must always be exactly "ธนาคารกสิกรไทย" — no English, no abbreviation.

Document layout:
- Title: "ใบเสร็จรับเงิน / ใบกำกับภาษี" / "RECEIPT / TAX INVOICE"
- "วันที่ออกเอกสาร / Issued Date"         → doc_date (→ DD/MM/YYYY)
- "เลขที่เอกสาร / Document number"        → doc_no  (e.g. 311225E00032857)
- "รหัสร้านค้า / MERCHANT ID"             → merchant_id (header field — numeric code)
- "ชื่อร้านค้า / MERCHANT NAME"           → merchant_name AND company_name (same value)
- "เลขประจำตัวผู้เสียภาษี / TAX ID"      → company_tax_id (digits only)
- "ที่อยู่ / ADDRESS"                      → company_address
- "บัญชีเงินฝาก / ACCOUNT" or account no → account_no
- wht_amount: search for "WITHHOLDING TAX OF FEE/COMMISSION AMOUNT AT X.XX BAHT" or "เป็นจำนวนเงิน X.XX บาท" → extract X.XX (document-level header)
- wht_rate: search the ENTIRE document including the paragraph at the bottom for any of these patterns:
    * "อัตรา X%" (Thai paragraph: "หักภาษีเงินได้ ณ ที่จ่าย...อัตรา 3%")
    * "หักภาษีในอัตรา X%"
    * "WITHHOLDING TAX...X%"
  Extract only the number e.g. "3.00" — do NOT return null if any rate pattern is found
- net_amount: the value in the "ยอดเงินสุทธิ / NET AMOUNT" column.
  For single-row documents: use the NET AMOUNT value from that detail row.
  For multi-row documents: use the TOTAL row's NET AMOUNT value.
  net_amount must NOT be null — always extract it from the NET AMOUNT column.

Main table columns:
    ประเภทการชำระ / PAYMENT TYPE        → transaction
    ยอดเงิน / AMOUNT                    → pay_amt
    ค่าธรรมเนียม / FEE/COMMISSION AMOUNT → commis_amt
    ภาษีมูลค่าเพิ่ม / VAT               → tax_amt
    ยอดเงินสุทธิ / NET AMOUNT            → total
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
        max_tokens=8192,
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

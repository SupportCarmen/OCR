"""OCR extraction prompt for KBANK (ธนาคารกสิกรไทย / Kasikornbank) documents."""

from app.llm.prompts._shared import ROW_RULES, OUTPUT_RULES

PROMPT = """You are extracting structured data from a KBANK (ธนาคารกสิกรไทย / Kasikornbank) receipt and tax invoice.

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
""" + ROW_RULES + OUTPUT_RULES

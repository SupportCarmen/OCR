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

Main table columns:
    ประเภทการชำระ / PAYMENT TYPE        → transaction
    ยอดเงิน / AMOUNT                    → pay_amt
    ค่าธรรมเนียม / FEE/COMMISSION AMOUNT → commis_amt
    ภาษีมูลค่าเพิ่ม / VAT               → tax_amt
    ยอดเงินสุทธิ / NET AMOUNT            → total
""" + ROW_RULES + OUTPUT_RULES

"""OCR extraction prompt for SCB (ธนาคารไทยพาณิชย์) documents."""

from app.llm.prompts._shared import ROW_RULES, OUTPUT_RULES

PROMPT = """You are extracting structured data from an SCB (ธนาคารไทยพาณิชย์) credit card summary receipt.

IMPORTANT: bank_name must always be exactly "ธนาคารไทยพาณิชย์" — no English, no abbreviation.

Document layout:
- Title: "ใบนำฝากเงิน/ใบสรุปยอดขายบัตรเครดิต/ใบกำกับภาษี"
- "เลขที่"                → doc_no
- "รายการประจำวันที่"      → doc_date (→ DD/MM/YYYY)
- "MERCHANT NUMBER"       → merchant_id (header field)
- "MERCHANT NAME"         → merchant_name (header field)
- "NAME" (address section) → company_name

Main table columns:
  CARD TYPE | S/D AMOUNT | DISCOUNT AMOUNT | VALUE ADDED TAX | AMOUNT CREDIT TO MERCHANT
  → transaction  pay_amt    commis_amt         tax_amt           total

CRITICAL FOR SCB:
1. Scan the ENTIRE table top to bottom — collect ALL rows where pay_amt > 0.
2. Do NOT stop scanning after finding a row — continue to end of table.
3. Example rows to include: VSA-INT-P, VSA-INT, MCA-INT-P, MCA-INT — any CARD TYPE with pay_amt > 0.
""" + ROW_RULES + OUTPUT_RULES

"""OCR extraction prompt for BBL (Bangkok Bank / ธนาคารกรุงเทพ) documents."""

from app.llm.prompts._shared import ROW_RULES, OUTPUT_RULES

PROMPT = """You are extracting structured data from a Bangkok Bank (ธนาคารกรุงเทพ / BBL) receipt and tax invoice.

IMPORTANT: bank_name must always be exactly "ธนาคารกรุงเทพ" — no English, no abbreviation.

Document layout:
- Title: "ใบเสร็จรับเงิน/ใบกำกับภาษี"
- "ชื่อ :"          → company_name
- "วันที่ :"        → doc_date (→ DD/MM/YYYY)
- "เลขที่ :"        → doc_no  (e.g. 25251-01-01485)
- หมายเลขร้านค้า (numeric code in table) → merchant_id (header field)
- merchant_name: same as company_name for BBL (no separate merchant name field)

Main data table columns:
    หมายเลขร้านค้า | จำนวนเงิน | ค่าธรรมเนียม | ภาษีมูลค่าเพิ่ม | จำนวนเงินสุทธิ
    → transaction      pay_amt      commis_amt      tax_amt           total

HOW TO EXTRACT ROWS:
- Each numeric merchant code row = ONE detail row.
- transaction = the merchant number (หมายเลขร้านค้า) from that row — BBL does NOT label card types separately, so use the merchant number as the transaction label.
- "จำนวนเงินรวม" is a TOTAL row — do NOT include as a detail row.
""" + ROW_RULES + OUTPUT_RULES

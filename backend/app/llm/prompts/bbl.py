"""OCR extraction prompt for BBL (Bangkok Bank / ธนาคารกรุงเทพ) documents."""

from app.llm.prompts._shared import ROW_RULES, OUTPUT_RULES

PROMPT = """You are extracting structured data from a Bangkok Bank (ธนาคารกรุงเทพ / BBL) receipt and tax invoice.

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
""" + ROW_RULES + OUTPUT_RULES

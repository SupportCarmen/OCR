"""Shared prompt fragments reused across all bank-specific OCR prompts."""

ROW_RULES = """
Rules for extracting details[] rows:
1. Include every card/payment type row that has a non-zero pay_amt.
2. SKIP rows labeled: จำนวนเงินรวม, TOTAL, รวม, GRAND TOTAL, NET AMOUNT, จำนวนเงินค่าธรรมเนียม — summary rows only.
3. SKIP rows where pay_amt is 0.00 or blank.
4. wht_amount is a document-level header field — do NOT put it inside any detail row.
"""

OUTPUT_RULES = """
Return ONLY a valid JSON object — no markdown fences, no explanation.
If a field is not present in the document, set it to null.
For monetary amounts, preserve the original format with commas (e.g. "10,342.12").
For doc_date, always convert to DD/MM/YYYY format.

CRITICAL: Each payment/card type row = ONE separate JSON object inside the "details" array.
Do NOT merge multiple rows into one object.

Header fields to extract:
- bank_companyname : ชื่อนิติบุคคลของธนาคาร (ผู้ออกเอกสาร) จาก header/footer ของธนาคาร — ไม่ใช่ชื่อร้านค้า
- bank_tax_id      : เลขประจำตัวผู้เสียภาษีของ**ธนาคาร** ตัวเลขล้วน — ไม่ใช่ Tax ID ร้านค้า
- bank_address     : ที่อยู่ของ**ธนาคาร** (สำนักงานใหญ่) จาก header/footer — ไม่ใช่ที่อยู่ร้านค้า
- branch_no        : รหัสสาขาของธนาคาร (ถ้ามี)
- bank_name        : ชื่อธนาคารภาษาไทย (กำหนดตายตัวในแต่ละ bank prompt)
- doc_name         : document title (e.g. "ใบเสร็จรับเงิน/ใบกำกับภาษี")
- company_name     : company name from address section (ชื่อ / NAME)
- company_tax_id   : merchant tax ID (เลขประจำตัวผู้เสียภาษี / TAX ID) — digits only, no label
- company_address  : merchant full address (ที่อยู่ / ADDRESS)
- account_no       : bank account number the money is deposited into (เลขที่บัญชี / ACCOUNT NO)
- doc_date         : document date → DD/MM/YYYY
- doc_no           : document number
- merchant_name    : MERCHANT NAME as shown in the merchant section
- merchant_id      : MERCHANT NUMBER / MERCHANT ID / หมายเลขร้านค้า — numeric code only
- wht_rate         : withholding tax RATE — extract only the number e.g. "3.00" — do NOT leave null if any rate pattern is found
- wht_amount       : withholding tax BAHT AMOUNT for the entire document (ภาษีหัก ณ ที่จ่าย / WITHHOLDING TAX) — document-level field only
- net_amount       : document-level NET AMOUNT / ยอดเงินสุทธิรวม (grand total after WHT deduction). Null if not shown.

Detail row fields (one object per card/payment type row):
- transaction  : card type / payment type label (e.g. "Visa", "Master", "VSA-INT-P") — null if not labeled
- pay_amt      : gross sale amount (S/D AMOUNT / ยอดเงิน / จำนวนเงิน)
- commis_amt   : commission / discount fee (DISCOUNT AMOUNT / ค่าธรรมเนียม)
- tax_amt      : VAT on commission (VALUE ADDED TAX / ภาษีมูลค่าเพิ่ม)
- total        : net amount credited to merchant per row (AMOUNT CREDIT TO MERCHANT / จำนวนเงินสุทธิ)

Output structure:
{"bank_companyname":…,"bank_tax_id":…,"bank_address":…,"branch_no":…,"bank_name":…,"doc_name":…,"company_name":…,"company_tax_id":…,"company_address":…,"account_no":…,"doc_date":…,"doc_no":…,"merchant_name":…,"merchant_id":…,"wht_rate":…,"wht_amount":…,"net_amount":…,"details":[{"transaction":…,"pay_amt":…,"commis_amt":…,"tax_amt":…,"total":…}]}
"""

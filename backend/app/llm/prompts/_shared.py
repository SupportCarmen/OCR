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
- bank_companyname : ชื่อนิติบุคคลของธนาคาร (ผู้ออกเอกสาร) ที่พิมพ์บนเอกสาร เช่น
                     "ธนาคารกรุงเทพ จำกัด (มหาชน)" / "บมจ. ธนาคารกสิกรไทย" / "ธนาคารไทยพาณิชย์ จํากัด (มหาชน)"
                     ให้ดึงจากหัวเอกสารหรือส่วน header ของธนาคาร ไม่ใช่ชื่อร้านค้า
- bank_tax_id      : เลขประจำตัวผู้เสียภาษีของ**ธนาคาร** (ผู้ออกเอกสาร) ตัวเลขล้วน เช่น "0107536000374"
                     ไม่ใช่ Tax ID ของร้านค้า — ให้ดูในส่วน header หรือ footer ของธนาคาร
- bank_address     : ที่อยู่ของ**ธนาคาร** ที่พิมพ์บนเอกสาร (สำนักงานใหญ่) เช่น
                     "333 ถนนสีลม เขตบางรัก กรุงเทพฯ 10500"
                     ให้ดึงจาก header/footer ของธนาคาร ไม่ใช่ที่อยู่ร้านค้า
- branch_no        : รหัสสาขาของธนาคาร (ถ้ามีระบุในเอกสาร)
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

Example:
{
  "bank_companyname": "ธนาคารกรุงเทพ จำกัด (มหาชน)",
  "bank_tax_id": "0107536000374",
  "bank_address": "333 ถนนสีลม เขตบางรัก กรุงเทพฯ 10500",
  "branch_no": "0000",
  "bank_name": "ธนาคารกรุงเทพ",
  "doc_name": "ใบเสร็จรับเงิน/ใบกำกับภาษี",
  "company_name": "บริษัท ยูไนเต็ด จำกัด",
  "company_tax_id": "0105555181506",
  "company_address": "89 ซอยสุขุมวิท 2 กทม.",
  "account_no": "206-0-90244-8",
  "doc_date": "09/09/2025",
  "doc_no": "25251-01-01485",
  "merchant_name": "UNITED CO.,LTD",
  "merchant_id": "002206198772",
  "wht_rate": "3.00",
  "wht_amount": "25.85",
  "net_amount": "28,636.58",
  "details": [
    {
      "transaction": "Visa",
      "pay_amt": "5,407.00",
      "commis_amt": "136.48",
      "tax_amt": "9.55",
      "total": "5,260.97"
    }
  ]
}
"""

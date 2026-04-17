"""
Prompt builder functions for GL account mapping suggestions.

Separates prompt text from the business logic in tools/map_gl.py.
"""

from typing import List


def build_fixed_fields_prompt(
    dept_lines: str,
    commission_acc_lines: str,
    balance_acc_lines: str,
    commission_acc_count: int,
    balance_acc_count: int,
) -> str:
    """Build the prompt for suggesting Commission / Tax Amount / Net Amount mappings."""
    return f"""You are an expert accounting assistant for a Thai company. You are mapping bank transaction fields to internal Account Codes (Master Chart of Accounts).

Suggest the best Department Code and Account Code for each field.

Matching Rules (IMPORTANT):
1. **Commission** (ค่าธรรมเนียม) — search Income (type=I) accounts only:
   - Search for names containing: "credit card commission", "commission credit card", "เครดิตการ์ดคอมมิชชั่น", "ค่าคอมมิชชั่นเครดิตการ์ด", "Bank Charge", "ค่าธรรมเนียมธนาคาร".

2. **Tax Amount** (ภาษีบนค่าธรรมเนียม) — search BalanceSheet (type=B) accounts only:
   - Search for names containing: "output tax undue", "ภาษีขายรอตัด", "ภาษีขายยังไม่ถึงกำหนด", "output vat undue", "sale tax undue".

3. **Net Amount** (ยอดรับสุทธิ) — search BalanceSheet (type=B) accounts only:
   - Search for names containing: "C/A", "S/A", "Bank", "ธนาคาร", "กระแสรายวัน", "ออมทรัพย์".

Available Department Codes:
{dept_lines if dept_lines else "  (none available)"}

Commission — Available Account Codes (type=I, {commission_acc_count} codes):
{commission_acc_lines if commission_acc_lines else "  (none available)"}

Tax Amount and Net Amount — Available Account Codes (type=B, {balance_acc_count} codes):
{balance_acc_lines if balance_acc_lines else "  (none available)"}

Return ONLY a valid JSON object — no markdown, no explanation:
{{
  "Commission":  {{"dept": "<dept_code or null>", "acc": "<acc_code or null>"}},
  "Tax Amount":  {{"dept": "<dept_code or null>", "acc": "<acc_code or null>"}},
  "Net Amount":  {{"dept": "<dept_code or null>", "acc": "<acc_code or null>"}}
}}

Rules:
- Only use codes that exist EXACTLY in the lists provided for each field above.
- Use null if no suitable code is found — never invent a code.
- dept codes are optional; if departments list is empty set all dept to null.
"""


def build_payment_types_prompt(
    types_list: str,
    dept_lines: str,
    acc_lines: str,
    b_account_count: int,
    payment_types: List[str],
) -> str:
    """Build the prompt for suggesting dept/acc for dynamic payment type rows."""
    return f"""You are an accounting assistant for a Thai company receiving credit card settlement reports.

Each payment type below is a card payment channel in the bank's settlement report. Suggest the best Department Code and Account Code for each.

Payment type naming conventions:
- VSA = Visa, MCA = Mastercard, JCB = JCB, UP = UnionPay, AMEX = American Express
- QR-VSA/QR-MCA/QR-JCB/QR-UPI = QR code payments, LCS = Local card scheme, TPN = Thai payment network
- -P suffix = Premium/Priority card, -INT = International transaction, -DCC = Dynamic Currency Conversion, -AFF = Affiliate
- These are all incoming payment amounts — mapped to a BalanceSheet (type=B) ASSET or RECEIVABLE account (เงินรับจากธนาคาร/ลูกหนี้ธนาคาร)

Payment types to suggest:
{types_list}

Available Department Codes (choose from this list only):
{dept_lines if dept_lines else "  (none available)"}

Available Account Codes — BalanceSheet type=B only ({b_account_count} codes):
{acc_lines if acc_lines else "  (none available)"}

Return ONLY a valid JSON object — no markdown, no explanation:
{{
  "<payment_type>": {{"dept": "<dept_code or null>", "acc": "<acc_code or null>"}},
  ...
}}

Rules:
- Only use codes that exist EXACTLY in the lists above.
- Use null if no suitable code is found — never invent a code.
- All payment types typically map to the same asset/receivable account since they are all bank settlement amounts.
"""

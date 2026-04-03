"""
Mapping router — AI suggestion + history for account/dept code mapping.

Endpoints:
  POST /api/v1/mapping/suggest        — LLM suggests dept/acc for commission, tax, net
  GET  /api/v1/mapping/history        — load confirmed history for a bank
  POST /api/v1/mapping/history/save   — save confirmed mappings to history
"""

import json
import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import MappingHistory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/mapping", tags=["Mapping"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class CodeOption(BaseModel):
    code: str
    name: str
    type: Optional[str] = None


class SuggestRequest(BaseModel):
    bank_name: str
    accounts: List[CodeOption]
    departments: List[CodeOption]


class FieldMapping(BaseModel):
    dept: Optional[str] = None
    acc: Optional[str] = None


class SuggestResponse(BaseModel):
    commission: FieldMapping
    tax: FieldMapping
    net: FieldMapping
    source: str  # 'ai' | 'history' | 'partial_ai'


class SuggestPaymentTypesRequest(BaseModel):
    bank_name: str
    payment_types: List[str]
    accounts: List[CodeOption]
    departments: List[CodeOption]


class SaveHistoryRequest(BaseModel):
    bank_name: str
    mappings: Dict[str, FieldMapping]   # field_type → {dept, acc}


# ── Helper ────────────────────────────────────────────────────────────────────

FIXED_SUGGEST_TYPES = ["Commission", "Tax Amount", "Net Amount"]


def _validate_codes(
    suggestion: dict,
    valid_acc: set,
    valid_dept: set,
) -> dict:
    """Zero out any suggested code that doesn't exist in the master lists."""
    for field in ("commission", "tax", "net"):
        row = suggestion.get(field, {})
        if row.get("dept") and row["dept"] not in valid_dept:
            row["dept"] = None
        if row.get("acc") and row["acc"] not in valid_acc:
            row["acc"] = None
        suggestion[field] = row
    return suggestion


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/suggest")
async def suggest_mapping(req: SuggestRequest):
    """Call LLM to suggest dept/acc codes for Commission, Tax Amount, and Net Amount (fixed types)."""
    try:
        if not settings.openrouter_api_key:
            return {"suggestions": {}, "source": "ai", "debug_v4": True}

        logger.info(f"--- [DEBUG] Entering suggest_mapping for {req.bank_name} ---")
        
        dept_lines = "\n".join(f"  {d.code} — {d.name}" for d in req.departments[:100])
        acc_lines  = "\n".join(f"  {a.code} — {a.name}" for a in req.accounts[:800])
        types_list = "\n".join(f"  - {t}" for t in FIXED_SUGGEST_TYPES)

        prompt = f"""You are an expert accounting assistant for a Thai company. You are mapping bank transaction fields to internal Account Codes (Master Chart of Accounts).

Suggest the best Department Code and Account Code for each field from {req.bank_name}.

Fields to suggest:
{types_list}

Matching Rules (IMPORTANT):
1. **Commission** (ค่าธรรมเนียม): 
   - Search for names containing: "credit card commission", "commission credit card", "เครดิตการ์ดคอมมิชชั่น", "ค่าคอมมิชชั่นเครดิตการ์ด", "Bank Charge", "ค่าธรรมเนียมธนาคาร".

2. **Tax Amount** (ภาษีบนค่าธรรมเนียม): 
   - Search for names containing: "output tax undue", "ภาษีขายรอตัด", "ภาษีขายยังไม่ถึงกำหนด", "output vat undue", "sale tax undue".

3. **Net Amount** (ยอดรับสุทธิ): 
   - Search for names containing: "C/A", "S/A", "Bank", "ธนาคาร", "กระแสรายวัน", "ออมทรัพย์".

Available Department Codes:
{dept_lines if dept_lines else "  (none available)"}

Available Account Codes (Search through all {len(req.accounts)} codes below):
{acc_lines if acc_lines else "  (none available)"}

Return ONLY a valid JSON object — no markdown, no explanation:
{{
  "Commission":  {{"dept": "<dept_code or null>", "acc": "<acc_code or null>"}},
  "Tax Amount":  {{"dept": "<dept_code or null>", "acc": "<acc_code or null>"}},
  "Net Amount":  {{"dept": "<dept_code or null>", "acc": "<acc_code or null>"}}
}}

Rules:
- Only use codes that exist EXACTLY in the lists above.
- Use null if no suitable code is found — never invent a code.
- dept codes are optional; if departments list is empty set all dept to null.
"""

        try:
            client = AsyncOpenAI(
                api_key=settings.openrouter_api_key,
                base_url=settings.openrouter_base_url,
            )
            logger.info(f"--- [DEBUG] Calling LLM API for {req.bank_name} ---")
            response = await client.chat.completions.create(
                model=settings.openrouter_suggestion_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=2048,
            )
        except Exception as e:
            logger.error(f"LLM API call failed for mapping suggestion (Bank: {req.bank_name}): {e}")
            return {"suggestions": {}, "source": "ai", "error": str(e), "debug_v4": True}

        content = None
        if response and response.choices and len(response.choices) > 0 and response.choices[0].message:
            content = response.choices[0].message.content
            
        if content is None:
            logger.warning(f"LLM returned None content for bank={req.bank_name}")
            return {"suggestions": {}, "source": "ai", "debug_v4": True}
        
        raw = str(content).strip()
        if not raw:
            logger.warning(f"LLM returned empty string for bank={req.bank_name}")
            return {"suggestions": {}, "source": "ai", "debug_v4": True}

        logger.info(f"LLM mapping suggestion raw: {raw[:200]}")

        if raw.startswith("```"):
            lines = raw.split("\n")
            if len(lines) > 1:
                last_line = lines[-1]
                if last_line is not None:
                    last_line = last_line.strip()
                    raw = "\n".join(lines[1:-1] if last_line == "```" else lines[1:]).strip()
                else:
                    raw = "\n".join(lines[1:]).strip()

        try:
            data: dict = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.warning(f"LLM returned invalid JSON for mapping suggestion: {e} | raw={raw[:300]}")
            return {"suggestions": {}, "source": "ai", "debug_v4": True}

        valid_acc  = {a.code for a in req.accounts}
        valid_dept = {d.code for d in req.departments}

        suggestions = {}
        for ptype in FIXED_SUGGEST_TYPES:
            mapping = data.get(ptype, {})
            dept = mapping.get("dept") if mapping.get("dept") in valid_dept else None
            acc  = mapping.get("acc")  if mapping.get("acc")  in valid_acc  else None
            suggestions[ptype] = {"dept": dept, "acc": acc}

        logger.info(f"--- [DEBUG] suggest_mapping for {req.bank_name} SUCCESS ---")
        return {"suggestions": suggestions, "source": "ai", "debug_v4": True}
    except Exception as exc:
        import traceback
        logger.error(f"--- [FATAL ERROR] suggest_mapping crashed: {exc} ---\n{traceback.format_exc()}")
        return {"suggestions": {}, "source": "ai", "fatal_error": str(exc), "debug_v4": True}


@router.post("/suggest-payment-types")
async def suggest_payment_types(req: SuggestPaymentTypesRequest):
    """Call LLM to suggest dept/acc codes for a list of payment types."""
    try:
        if not settings.openrouter_api_key or not req.payment_types:
            return {"suggestions": {}, "source": "ai", "debug_v4": True}

        logger.info(f"--- [DEBUG] Entering suggest_payment_types for {req.bank_name} ---")

        dept_lines = "\n".join(f"  {d.code} — {d.name}" for d in req.departments[:80])
        acc_lines  = "\n".join(f"  {a.code} — {a.name}" for a in req.accounts[:200])
        types_list = "\n".join(f"  - {t}" for t in req.payment_types)

        prompt = f"""You are an accounting assistant for a Thai company receiving credit card settlement reports from {req.bank_name}.

Each payment type below is a card payment channel in the bank's settlement report. Suggest the best Department Code and Account Code for each.

Payment type naming conventions:
- VSA = Visa, MCA = Mastercard, JCB = JCB, UP = UnionPay, AMEX = American Express
- QR-VSA/QR-MCA/QR-JCB/QR-UPI = QR code payments, LCS = Local card scheme, TPN = Thai payment network
- -P suffix = Premium/Priority card, -INT = International transaction, -DCC = Dynamic Currency Conversion, -AFF = Affiliate
- These are all incoming payment amounts — typically mapped to an ASSET or RECEIVABLE account (เงินรับจากธนาคาร/ลูกหนี้ธนาคาร)

Payment types to suggest:
{types_list}

Available Department Codes (choose from this list only):
{dept_lines if dept_lines else "  (none available)"}

Available Account Codes (choose from this list only):
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

        try:
            client = AsyncOpenAI(
                api_key=settings.openrouter_api_key,
                base_url=settings.openrouter_base_url,
            )
            logger.info(f"--- [DEBUG] Calling LLM API for payment types {req.bank_name} ---")
            response = await client.chat.completions.create(
                model=settings.openrouter_suggestion_model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=2048,
            )
        except Exception as e:
            logger.error(f"LLM API call failed for payment type suggestions: {e}")
            return {"suggestions": {}, "source": "ai", "error": str(e), "debug_v4": True}

        content = None
        if response and response.choices and len(response.choices) > 0 and response.choices[0].message:
            content = response.choices[0].message.content

        if content is None:
            logger.warning(f"LLM returned None content for payment types, bank={req.bank_name}")
            return {"suggestions": {}, "source": "ai", "debug_v4": True}
        
        raw = str(content).strip()
        if not raw:
            logger.warning(f"LLM returned empty string for payment types, bank={req.bank_name}")
            return {"suggestions": {}, "source": "ai", "debug_v4": True}

        logger.info(f"LLM payment type suggestion raw: {raw[:200]}")

        if raw.startswith("```"):
            lines = raw.split("\n")
            if len(lines) > 1:
                last_line = lines[-1]
                if last_line is not None:
                    last_line = last_line.strip()
                    raw = "\n".join(lines[1:-1] if last_line == "```" else lines[1:]).strip()
                else:
                    raw = "\n".join(lines[1:]).strip()

        try:
            data: dict = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.warning(f"LLM returned invalid JSON for payment type suggestion: {e} | raw={raw[:300]}")
            return {"suggestions": {}, "source": "ai", "debug_v4": True}

        valid_acc  = {a.code for a in req.accounts}
        valid_dept = {d.code for d in req.departments}

        suggestions = {}
        for ptype, mapping in data.items():
            if ptype not in req.payment_types:
                continue
            dept = mapping.get("dept") if mapping.get("dept") in valid_dept else None
            acc  = mapping.get("acc")  if mapping.get("acc")  in valid_acc  else None
            suggestions[ptype] = {"dept": dept, "acc": acc}

        logger.info(f"--- [DEBUG] suggest_payment_types for {req.bank_name} SUCCESS ---")
        return {"suggestions": suggestions, "source": "ai", "debug_v4": True}
    except Exception as exc:
        import traceback
        logger.error(f"--- [FATAL ERROR] suggest_payment_types crashed: {exc} ---\n{traceback.format_exc()}")
        return {"suggestions": {}, "source": "ai", "fatal_error": str(exc), "debug_v4": True}


@router.get("/history")
async def get_mapping_history(bank_name: str, db: AsyncSession = Depends(get_db)):
    """Return all saved mapping history rows for a given bank."""
    result = await db.execute(
        select(MappingHistory).where(MappingHistory.bank_name == bank_name)
    )
    rows = result.scalars().all()

    history: Dict[str, dict] = {}
    for row in rows:
        history[row.field_type] = {
            "dept": row.dept_code,
            "acc": row.acc_code,
            "confirmed_count": row.confirmed_count,
        }
    return {"bank_name": bank_name, "history": history}


@router.post("/history/save")
async def save_mapping_history(req: SaveHistoryRequest, db: AsyncSession = Depends(get_db)):
    """Upsert confirmed mappings into history (INSERT or UPDATE confirmed_count)."""
    saved = 0
    for field_type, mapping in req.mappings.items():
        if not mapping.dept and not mapping.acc:
            continue  # skip empty rows

        result = await db.execute(
            select(MappingHistory).where(
                MappingHistory.bank_name == req.bank_name,
                MappingHistory.field_type == field_type,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.dept_code = mapping.dept
            existing.acc_code = mapping.acc
            existing.confirmed_count = (existing.confirmed_count or 0) + 1
            await db.execute(
                text("UPDATE mapping_history SET updated_at = CURRENT_TIMESTAMP WHERE id = :id"),
                {"id": existing.id},
            )
        else:
            db.add(MappingHistory(
                bank_name=req.bank_name,
                field_type=field_type,
                dept_code=mapping.dept,
                acc_code=mapping.acc,
                confirmed_count=1,
            ))
        saved += 1

    await db.commit()
    logger.info(f"Saved {saved} mapping history rows for bank={req.bank_name}")
    return {"ok": True, "saved": saved}

"""
Tool: map_gl

LLM-powered GL account/department mapping suggestions.

Two entry points:
  suggest_fixed_fields()    — Commission, Tax Amount, Net Amount (always present)
  suggest_payment_types()   — Dynamic card/payment type rows (Visa, MCA, QR, etc.)

Both return ToolResult with output = {suggestions: {field_type: {dept, acc}}, source: "ai"}
"""

import logging
import traceback
from typing import Any, Dict, List

from app.config import settings
from app.llm.client import call_text_llm
from app.llm.prompts.mapping import build_fixed_fields_prompt, build_payment_types_prompt
from app.tools.base import ToolResult

logger = logging.getLogger(__name__)

TOOL_FIXED   = "suggest_gl_fixed_fields"
TOOL_PAYMENT = "suggest_gl_payment_types"

FIXED_TYPES = ["Commission", "Tax Amount", "Net Amount"]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _filter_by_type(accounts: List[Dict], target_type: str) -> List[Dict]:
    """Return accounts whose type matches target_type; falls back to all if none match."""
    t = target_type.lower()
    filtered = [a for a in accounts if (a.get("type") or "").lower() == t]
    return filtered if filtered else accounts


def _filter_by_keywords(accounts: List[Dict], keywords: List[str], limit: int, fallback_limit: int = 30) -> List[Dict]:
    """Score accounts by keyword hits in name, return top `limit` matches.
    If fewer than fallback_limit match, pad with unmatched accounts up to limit."""
    if not accounts:
        return []
    scored, unmatched = [], []
    for acc in accounts:
        name = (acc.get("name") or "").lower()
        score = sum(1 for kw in keywords if kw in name)
        (scored if score else unmatched).append((score, acc))
    scored.sort(key=lambda x: -x[0])
    result = [acc for _, acc in scored[:limit]]
    if len(result) < fallback_limit:
        result.extend(acc for _, acc in unmatched[:limit - len(result)])
    return result


def _validate_codes(
    data: dict,
    keys: List[str],
    valid_acc: set,
    valid_dept: set,
    acc_type_map: Dict[str, str],
) -> Dict[str, Dict]:
    """Validate LLM output codes exist in allowed sets; force dept=GEN for BalanceSheet accounts."""
    suggestions = {}
    for key in keys:
        mapping = data.get(key, {})
        dept = mapping.get("dept") if mapping.get("dept") in valid_dept else None
        acc  = mapping.get("acc")  if mapping.get("acc")  in valid_acc  else None
        if acc and acc_type_map.get(acc) == "balancesheet":
            dept = "GEN"
        suggestions[key] = {"dept": dept, "acc": acc}
    return suggestions


# ── Tools ─────────────────────────────────────────────────────────────────────

async def suggest_fixed_fields(
    accounts: List[Dict[str, Any]],
    departments: List[Dict[str, Any]],
) -> ToolResult:
    """
    Suggest dept/acc for Commission, Tax Amount, Net Amount.

    accounts / departments: list of {code, name, type?} dicts
    """
    tool_input = {"fields": FIXED_TYPES, "account_count": len(accounts), "dept_count": len(departments)}
    try:
        if not settings.openrouter_api_key:
            return ToolResult(success=True, tool=TOOL_FIXED, input=tool_input,
                              output={"suggestions": {}, "source": "ai"})

        acc_type_map   = {a["code"]: (a.get("type") or "").lower() for a in accounts}
        commission_acc = _filter_by_type(accounts, "income")
        balance_acc    = _filter_by_type(accounts, "balancesheet")

        # Pre-filter by domain keywords — reduces list from 800 → ~20 before sending to LLM
        commission_filtered = _filter_by_keywords(
            commission_acc,
            ["commission", "credit card", "เครดิตการ์ด", "ค่าธรรมเนียม", "bank charge"],
            limit=40,
        )
        balance_filtered = _filter_by_keywords(
            balance_acc,
            ["output tax", "ภาษีขาย", "undue", "รอตัด", "bank", "ธนาคาร", "c/a", "s/a",
             "กระแสรายวัน", "ออมทรัพย์", "receivable", "ลูกหนี้"],
            limit=50,
        )

        dept_lines           = "\n".join(f"  {d['code']} {d['name']}" for d in departments[:50])
        commission_acc_lines = "\n".join(f"  {a['code']} {a['name']}" for a in commission_filtered)
        balance_acc_lines    = "\n".join(f"  {a['code']} {a['name']}" for a in balance_filtered)

        prompt = build_fixed_fields_prompt(
            dept_lines=dept_lines,
            commission_acc_lines=commission_acc_lines,
            balance_acc_lines=balance_acc_lines,
            commission_acc_count=len(commission_filtered),
            balance_acc_count=len(balance_filtered),
        )

        data = await call_text_llm(prompt, usage_type="MAPPING_SUGGESTION")
        if data is None:
            return ToolResult(success=True, tool=TOOL_FIXED, input=tool_input,
                              output={"suggestions": {}, "source": "ai"})

        valid_acc  = {a["code"] for a in accounts}
        valid_dept = {d["code"] for d in departments}
        suggestions = _validate_codes(data, FIXED_TYPES, valid_acc, valid_dept, acc_type_map)

        logger.info(f"[{TOOL_FIXED}] completed — {len(suggestions)} fields suggested")
        return ToolResult(
            success=True,
            tool=TOOL_FIXED,
            input=tool_input,
            output={"suggestions": suggestions, "source": "ai"},
        )

    except Exception as exc:
        logger.error(f"[{TOOL_FIXED}] error: {exc}\n{traceback.format_exc()}")
        return ToolResult(
            success=True,   # graceful degradation — empty suggestions, not a hard failure
            tool=TOOL_FIXED,
            input=tool_input,
            output={"suggestions": {}, "source": "ai"},
            errors=[str(exc)],
        )


async def suggest_payment_types(
    payment_types: List[str],
    accounts: List[Dict[str, Any]],
    departments: List[Dict[str, Any]],
) -> ToolResult:
    """
    Suggest dept/acc for a dynamic list of payment types (Visa, MCA, QR, etc.).

    accounts / departments: list of {code, name, type?} dicts
    """
    tool_input = {"payment_types": payment_types, "account_count": len(accounts), "dept_count": len(departments)}
    try:
        if not settings.openrouter_api_key or not payment_types:
            return ToolResult(success=True, tool=TOOL_PAYMENT, input=tool_input,
                              output={"suggestions": {}, "source": "ai"})

        acc_type_map = {a["code"]: (a.get("type") or "").lower() for a in accounts}
        b_accounts   = _filter_by_type(accounts, "balancesheet")

        # Payment types are bank receivables — pre-filter to bank/receivable accounts
        b_filtered = _filter_by_keywords(
            b_accounts,
            ["bank", "ธนาคาร", "receivable", "ลูกหนี้", "credit card", "เครดิตการ์ด",
             "settlement", "c/a", "s/a", "กระแสรายวัน", "ออมทรัพย์"],
            limit=40,
        )

        dept_lines = "\n".join(f"  {d['code']} {d['name']}" for d in departments[:50])
        acc_lines  = "\n".join(f"  {a['code']} {a['name']}" for a in b_filtered)
        types_list = "\n".join(f"  - {t}" for t in payment_types)

        prompt = build_payment_types_prompt(
            types_list=types_list,
            dept_lines=dept_lines,
            acc_lines=acc_lines,
            b_account_count=len(b_filtered),
            payment_types=payment_types,
        )

        data = await call_text_llm(prompt, usage_type="MAPPING_SUGGESTION")
        if data is None:
            return ToolResult(success=True, tool=TOOL_PAYMENT, input=tool_input,
                              output={"suggestions": {}, "source": "ai"})

        valid_acc  = {a["code"] for a in accounts}
        valid_dept = {d["code"] for d in departments}
        # Only keep keys that were requested
        suggestions = _validate_codes(
            {k: v for k, v in data.items() if k in payment_types},
            [k for k in data if k in payment_types],
            valid_acc, valid_dept, acc_type_map,
        )

        logger.info(f"[{TOOL_PAYMENT}] completed — {len(suggestions)}/{len(payment_types)} types suggested")
        return ToolResult(
            success=True,
            tool=TOOL_PAYMENT,
            input=tool_input,
            output={"suggestions": suggestions, "source": "ai"},
        )

    except Exception as exc:
        logger.error(f"[{TOOL_PAYMENT}] error: {exc}\n{traceback.format_exc()}")
        return ToolResult(
            success=True,   # graceful degradation
            tool=TOOL_PAYMENT,
            input=tool_input,
            output={"suggestions": {}, "source": "ai"},
            errors=[str(exc)],
        )

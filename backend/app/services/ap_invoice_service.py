import logging
import json
from typing import List, Dict, Any, Optional

from app.config import settings
from app.llm.client import get_client, call_text_llm
from app.llm.prompts.ap_invoice import PROMPT as AP_INVOICE_PROMPT
from app.llm.prompts.mapping import build_ap_expense_prompt
from app.services.ap_invoice_postprocess import postprocess as postprocess_ap_invoice

logger = logging.getLogger(__name__)

# Category → search keywords for pre-filtering expense accounts
_CATEGORY_KW: dict[str, list[str]] = {
    "ค่าบริการ":      ["บริการ", "service", "fee", "ค่าจ้าง"],
    "ซอฟต์แวร์":     ["software", "ซอฟต์แวร์", "it", "ไอที", "license", "program"],
    "อุปกรณ์ไอที":   ["it", "computer", "อุปกรณ์", "equipment", "ไอที"],
    "วัสดุสำนักงาน": ["วัสดุ", "สำนักงาน", "office", "stationery"],
    "ค่าโฆษณา":      ["โฆษณา", "advertis", "marketing", "promotion"],
    "ค่าขนส่ง":      ["ขนส่ง", "transport", "delivery", "freight", "logistic"],
    "ค่าเช่า":       ["เช่า", "rent", "lease"],
    "วัตถุดิบ":      ["วัตถุดิบ", "raw material", "material"],
    "บรรจุภัณฑ์":   ["บรรจุ", "packaging", "package"],
    "ยา-เวชภัณฑ์":  ["ยา", "เวชภัณฑ์", "medical", "pharma"],
    "เงินมัดจำ":     ["มัดจำ", "deposit", "advance"],
}

def _filter_expense_accounts(accounts: list[dict], items: list[dict], max_acc: int = 60) -> list[dict]:
    """Return the most relevant expense accounts for the given items by
    keyword-scoring against category + description. Falls back to the first
    `max_acc` accounts when nothing matches."""
    if not accounts:
        return []
    keywords: set[str] = set()
    for item in items:
        cat = (item.get("category") or "").lower()
        desc = (item.get("description") or "").lower()
        for cat_key, kws in _CATEGORY_KW.items():
            if cat_key in cat or any(kw in cat for kw in kws):
                keywords.update(kws)
        keywords.update(w for w in desc.split() if len(w) >= 3)

    if not keywords:
        return accounts[:max_acc]

    scored, unmatched = [], []
    for acc in accounts:
        name_lower = (acc.get("name") or "").lower()
        score = sum(1 for kw in keywords if kw in name_lower)
        (scored if score else unmatched).append((score, acc))

    scored.sort(key=lambda x: -x[0])
    result = [acc for _, acc in scored[:max_acc]]
    if len(result) < max_acc:
        result.extend(acc for _, acc in unmatched[:max_acc - len(result)])
    return result


async def extract_ap_invoice_data(data_url: str, filename: str, task_id: str) -> Dict[str, Any]:
    """Extract AP Invoice details using Vision LLM."""
    prompt = AP_INVOICE_PROMPT
    ap_model = settings.openrouter_ap_invoice_model or settings.openrouter_ocr_model
    logger.info(f"Extracting AP Invoice: {filename} (model: {ap_model})")
    
    client = get_client()

    try:
        response = await client.chat.completions.create(
            model=ap_model,
            messages=[
                {
                    "role": "system",
                    "content": prompt,
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": data_url},
                        },
                        {
                            "type": "text",
                            "text": "Extract details and return JSON.",
                        },
                    ],
                },
            ],
            temperature=0.0,
            max_tokens=8192,
        )
    except Exception as e:
        logger.error(f"LLM API Error: {e}")
        raise RuntimeError("Failed to connect to LLM service")

    if response.usage:
        from app.services.usage_service import log_llm_usage
        await log_llm_usage(
            model=ap_model,
            prompt_tokens=response.usage.prompt_tokens,
            completion_tokens=response.usage.completion_tokens,
            total_tokens=response.usage.total_tokens,
            task_id=task_id,
            usage_type="AP_INVOICE"
        )

    raw_content = response.choices[0].message.content if (response.choices and response.choices[0].message) else None
    if not raw_content:
        raise RuntimeError("Empty response from LLM")

    result_text = raw_content.strip()
    if result_text.startswith("```"):
        lines = result_text.split("\n")
        if len(lines) > 1:
            last_line = lines[-1].strip()
            result_text = "\n".join(lines[1:-1] if last_line == "```" else lines[1:])
            result_text = result_text.strip()

    try:
        data = json.loads(result_text)
    except json.JSONDecodeError as e:
        logger.error(f"JSON Decode Error. Raw text: {result_text}")
        raise RuntimeError("LLM returned invalid JSON")

    return postprocess_ap_invoice(data)


async def suggest_gl_for_items(items_payload: List[Dict[str, Any]], accounts_raw: Dict[str, Any], depts_raw: Dict[str, Any]) -> Dict[str, Any]:
    """AI-suggest dept/acc for AP invoice expense items using category + description."""
    
    accounts = [
        {"code": a["AccCode"], "name": a.get("Description") or "", "type": (a.get("Type") or "").lower()}
        for a in (accounts_raw.get("Data") or [])
        if a.get("AccCode") and a.get("AccCode") != "AccCode"
    ]
    departments = [
        {"code": d["DeptCode"], "name": d.get("Description") or ""}
        for d in (depts_raw.get("Data") or [])
        if d.get("DeptCode") and d.get("DeptCode") != "CodeDep"
    ]

    expense_accounts = [a for a in accounts if a["type"] in ("e", "expense")] or accounts

    # Pre-filter to the most relevant accounts
    filtered_accounts = _filter_expense_accounts(expense_accounts, items_payload)

    dept_lines = "\n".join(f"  {d['code']} {d['name']}" for d in departments[:50])
    expense_acc_lines = "\n".join(f"  {a['code']} {a['name']}" for a in filtered_accounts)

    prompt = build_ap_expense_prompt(
        items=items_payload,
        dept_lines=dept_lines,
        expense_acc_lines=expense_acc_lines,
        expense_acc_count=len(filtered_accounts),
    )

    data = await call_text_llm(prompt, usage_type="AP_GL_SUGGESTION")
    if data is None:
        return {}

    valid_acc_map = {str(a["code"]).strip(): a["code"] for a in accounts}
    valid_dept_map = {str(d["code"]).strip(): d["code"] for d in departments}

    # Unwrap if LLM nested it under "suggestions"
    if "suggestions" in data and isinstance(data["suggestions"], dict):
        data = data["suggestions"]

    suggestions = {}
    for item in items_payload:
        key = str(item["index"])
        mapping = data.get(key) or data.get(item["index"]) or {}
        
        raw_dept = mapping.get("dept")
        raw_acc = mapping.get("acc")
        
        dept_str = str(raw_dept).strip() if raw_dept is not None else None
        acc_str = str(raw_acc).strip() if raw_acc is not None else None

        dept = valid_dept_map.get(dept_str) if dept_str else None
        acc = valid_acc_map.get(acc_str) if acc_str else None
        suggestions[item["index"]] = {"deptCode": dept, "accountCode": acc}

    return suggestions

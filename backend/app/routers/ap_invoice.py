import logging
import json
import base64
import os
from typing import List

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.llm.client import get_client, call_text_llm
from app.llm.prompts.ap_invoice import PROMPT as AP_INVOICE_PROMPT
from app.llm.prompts.mapping import build_ap_expense_prompt
from app.services.ap_invoice_postprocess import postprocess as postprocess_ap_invoice
from app.services.carmen_service import get_account_codes, get_departments, CarmenAPIError
from app.database import get_db
from app.models.orm import OCRTask, TaskStatus
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ap-invoice", tags=["AP Invoice"])

def _get_mime_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".bmp": "image/bmp",
        ".pdf": "application/pdf",
    }.get(ext, "image/jpeg")

@router.post("/extract")
async def extract_ap_invoice(
    file: UploadFile = File(..., description="รูปใบแจ้งหนี้/ใบกำกับภาษี AP (JPG, PNG, PDF)"),
    db: AsyncSession = Depends(get_db)
):
    """
    Stateless AP Invoice OCR extraction using Vision LLM (OpenRouter).
    Passes the file to Gemini 2.5 Flash/Claude to extract structured item lines.
    """
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    file_bytes = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_file_size_mb}MB limit")

    mime_type = _get_mime_type(file.filename)
    b64_image = base64.b64encode(file_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_image}"

    # Create task for tracking
    task = OCRTask(
        id=str(uuid.uuid4()),
        original_filename=file.filename,
        file_path="STATLESS_AP_INVOICE",
        status=TaskStatus.COMPLETED,
        ocr_engine=settings.ocr_engine,
    )
    db.add(task)
    await db.commit()
    task_id = task.id

    prompt = AP_INVOICE_PROMPT

    ap_model = settings.openrouter_ap_invoice_model or settings.openrouter_ocr_model
    logger.info(f"Extracting AP Invoice: {file.filename} (model: {ap_model})")
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
        raise HTTPException(status_code=500, detail="Failed to connect to LLM service")

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
        raise HTTPException(status_code=500, detail="Empty response from LLM")

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
        raise HTTPException(status_code=500, detail="LLM returned invalid JSON")

    return postprocess_ap_invoice(data)


class SuggestGLItem(BaseModel):
    index: int
    category: str = ""
    description: str = ""

class SuggestGLRequest(BaseModel):
    items: List[SuggestGLItem]


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


@router.post("/suggest-gl")
async def suggest_gl(body: SuggestGLRequest):
    """AI-suggest dept/acc for AP invoice expense items using category + description."""
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")
    if not body.items:
        return {"suggestions": {}}

    try:
        accounts_raw = await get_account_codes()
        depts_raw = await get_departments()
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Carmen API error: {e.detail}")

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
    items_payload = [{"index": i.index, "category": i.category, "description": i.description} for i in body.items]

    # Pre-filter to the most relevant accounts — avoids sending 500+ lines to LLM
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
        return {"suggestions": {}}

    valid_acc = {a["code"] for a in accounts}
    valid_dept = {d["code"] for d in departments}

    suggestions = {}
    for item in body.items:
        key = str(item.index)
        mapping = data.get(key) or data.get(item.index, {})
        dept = mapping.get("dept") if mapping.get("dept") in valid_dept else None
        acc = mapping.get("acc") if mapping.get("acc") in valid_acc else None
        suggestions[item.index] = {"deptCode": dept, "accountCode": acc}

    return {"suggestions": suggestions}

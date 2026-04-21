import logging
import json
import base64
import os
from typing import Optional, List

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.llm.client import get_client
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

    # Prompt adapted from frontend
    prompt = '''คุณเป็น AI สำหรับดึงข้อมูลจากใบกำกับภาษี/ใบแจ้งหนี้ ส่งกลับ JSON เท่านั้น (ไม่มี markdown):
{
  "vendorName": "ชื่อบริษัทผู้ขาย",
  "vendorTaxId": "เลขผู้เสียภาษี 13 หลัก",
  "vendorBranch": "สาขา เช่น สำนักงานใหญ่ หรือ 00001",
  "documentName": "ชื่อเอกสาร เช่น ใบกำกับภาษี / Invoice",
  "documentDate": "DD/MM/YYYY",
  "documentNumber": "เลขที่เอกสาร",
  "taxType": "Include หรือ Exclude",
  "items": [{
    "category": "หมวดบัญชี เช่น วัสดุสำนักงาน",
    "description": "รายละเอียดสินค้า/บริการ",
    "qty": 0,
    "unitPrice": 0,
    "discountPct": 0,
    "discountAmt": 0,
    "lineSubTotal": 0,
    "taxPct": 7,
    "taxType": "Include หรือ Exclude",
    "taxAmt": 0,
    "lineTotal": 0
  }],
  "subTotal": 0,
  "taxAmount": 0,
  "totalDiscount": 0,
  "grandTotal": 0
}

== คำจำกัดความ taxType ==
Exclude (ภาษีนอก — พบบ่อยในใบกำกับภาษีทั่วไป):
  - ราคาสินค้าบนเอกสารยังไม่รวมภาษี
  - lineSubTotal = ราคาก่อนภาษีของรายการนั้น
  - taxAmt = lineSubTotal × taxPct% (ภาษีที่บวกเพิ่ม)
  - lineTotal = lineSubTotal - discountAmt + taxAmt
  - grandTotal = subTotal - totalDiscount + taxAmount

Include (ภาษีใน — พบในใบเสร็จรับเงิน/ราคาขายปลีก):
  - ราคาสินค้าบนเอกสารรวมภาษีแล้ว
  - lineSubTotal = ราคารวมภาษีของรายการนั้น
  - taxAmt = lineSubTotal × taxPct ÷ (100 + taxPct)  [ถอยกลับออกจากราคา]
  - lineTotal = lineSubTotal - discountAmt  [ไม่บวก taxAmt ซ้ำ]
  - grandTotal = subTotal - totalDiscount  [ไม่บวก taxAmount ซ้ำ]

== วิธีพิจารณา taxType (ทำตามลำดับนี้เท่านั้น) ==

ขั้นตอนที่ 1: บวกยอดเงินทุกบรรทัดในคอลัมน์ "รวม/Amount/จำนวนเงิน" → ได้ LINE_SUM
  (ใช้ค่าจากคอลัมน์ line items โดยตรง ไม่ใช่ค่าจาก footer)

ขั้นตอนที่ 2: อ่าน grandTotal (ยอดรวมทั้งสิ้น/Net Total/ทั้งหมด) และ VAT จาก footer

ขั้นตอนที่ 3: เปรียบเทียบ
  - LINE_SUM ≈ grandTotal → taxType = "Include"
    (ราคาในบรรทัดรวม VAT ไว้แล้ว footer แสดง net แบบ back-calculate เพื่ออ้างอิง)
  - LINE_SUM + VAT ≈ grandTotal → taxType = "Exclude"
    (ราคาในบรรทัดยังไม่รวม VAT ต้องบวก VAT จึงจะได้ grandTotal)

ตัวอย่าง Include: LINE_SUM=110, VAT=7.20, grandTotal=110
  → 110 ≈ 110 ✓ → Include
  → footer "ผลรวม" 102.80 คือ back-calculate (110÷1.07) แสดงเพื่ออ้างอิงเท่านั้น ห้ามใช้ตัดสิน taxType

ตัวอย่าง Exclude: LINE_SUM=3800, VAT=266, grandTotal=4066
  → 3800 + 266 = 4066 ✓ → Exclude

คำเตือน: footer บางเอกสารแสดง "ผลรวม/net" ที่น้อยกว่า LINE_SUM (เพราะเป็น back-calculated net)
  อย่านำค่า "ผลรวม/net" จาก footer มาใช้ในการเปรียบเทียบเพื่อตัดสิน taxType

== กฎกรอกค่า field ของแต่ละรายการ ==

กรณี Exclude:
  - lineSubTotal = ราคาก่อนภาษีของบรรทัด (ค่าในคอลัมน์ Amount/จำนวนเงิน)
  - taxAmt = lineSubTotal × taxPct ÷ 100
  - lineTotal = lineSubTotal - discountAmt + taxAmt  ← บวก taxAmt เข้าไป

กรณี Include:
  - lineSubTotal = ราคารวมภาษีของบรรทัด (ค่าในคอลัมน์ Amount/จำนวนเงิน)
  - taxAmt = lineSubTotal × taxPct ÷ (100 + taxPct)  ← ถอยกลับออก
  - lineTotal = lineSubTotal - discountAmt  ← ห้ามบวก taxAmt ซ้ำ เพราะอยู่ใน lineSubTotal แล้ว

subTotal (header) กรณี Exclude = sum(lineSubTotal)  [ก่อนภาษี]
subTotal (header) กรณี Include = sum(lineSubTotal) ÷ (1 + taxPct/100)  [net back-calculated]

หากไม่พบค่าใดให้ใส่ "" สำหรับข้อความ หรือ 0 สำหรับตัวเลข'''

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

    return data

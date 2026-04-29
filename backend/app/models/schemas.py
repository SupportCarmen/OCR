from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field

from .enums import TaskStatus, BankType


class ReceiptSchema(BaseModel):
    id: str
    task_id: str
    bank_name: Optional[str] = None
    bank_type: Optional[BankType] = None
    doc_name: Optional[str] = None
    company_name: Optional[str] = None
    doc_date: Optional[str] = None
    doc_no: Optional[str] = None
    merchant_name: Optional[str] = None
    bank_companyname: Optional[str] = None
    submitted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    transactions: List[str] = []

    class Config:
        from_attributes = True


class OCRTaskResponse(BaseModel):
    id: str
    original_filename: str
    status: TaskStatus
    ocr_engine: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    receipt: Optional[ReceiptSchema] = None

    class Config:
        from_attributes = True


class OCRTaskListResponse(BaseModel):
    total: int
    tasks: List[OCRTaskResponse]


class OCRUploadResponse(BaseModel):
    message: str
    task_ids: List[str]
    total_files: int


class ExtractedDetailRow(BaseModel):
    transaction: Optional[str] = None
    pay_amt: Optional[str] = None
    commis_amt: Optional[str] = None
    tax_amt: Optional[str] = None
    total: Optional[str] = None


class ExtractedReceiptData(BaseModel):
    bank_name: Optional[str] = Field(None, description="ชื่อธนาคาร")
    doc_name: Optional[str] = Field(None, description="ประเภทเอกสาร")
    company_name: Optional[str] = Field(None, description="ชื่อบริษัท")
    doc_date: Optional[str] = Field(None, description="วันที่เอกสาร")
    doc_no: Optional[str] = Field(None, description="เลขที่เอกสาร")
    merchant_name: Optional[str] = Field(None, description="ชื่อร้านค้า / MERCHANT NAME จากธนาคาร")
    merchant_id: Optional[str] = Field(None, description="หมายเลขร้านค้า / MERCHANT NUMBER / Terminal ID")
    bank_companyname: Optional[str] = Field(None, description="ชื่อนิติบุคคลของธนาคาร")
    branch_no: Optional[str] = Field(None, description="รหัสสาขาของธนาคาร (ถ้ามี)")
    details: List[ExtractedDetailRow] = Field(default_factory=list, description="รายการ card/payment type rows")
    is_duplicate: bool = Field(False, description="True ถ้า doc_no นี้มีอยู่ใน DB แล้ว (submitted)")
    raw_text: Optional[str] = Field(None, description="ข้อความดิบที่ดึงได้จาก OCR")


class CorrectionFeedbackRequest(BaseModel):
    receipt_id: str
    bank_type: str
    field_name: str
    original_value: Optional[str] = None
    corrected_value: Optional[str] = None


class CorrectionFeedbackResponse(BaseModel):
    id: int
    receipt_id: str
    bank_type: str
    field_name: str
    original_value: Optional[str] = None
    corrected_value: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

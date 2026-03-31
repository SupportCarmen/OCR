"""
Pydantic schemas & SQLAlchemy ORM models for OCR tasks and extracted receipt data.
"""

from datetime import datetime
from typing import Optional, List
from enum import Enum
import uuid

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, Float, DateTime, Text, Enum as SAEnum
from sqlalchemy.sql import func

from app.database import Base


# ═══════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════

class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class OCREngine(str, Enum):
    GOOGLE_VISION = "google_vision"
    PADDLEOCR = "paddleocr"


# ═══════════════════════════════════════════════════
# SQLAlchemy ORM Models (Database Tables)
# ═══════════════════════════════════════════════════

class OCRTask(Base):
    """Represents a single OCR processing task."""
    __tablename__ = "ocr_tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    status = Column(SAEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    ocr_engine = Column(String, nullable=True)
    raw_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    # ── Extracted Structured Fields ──
    bank_name = Column(String, nullable=True)
    doc_name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    doc_date = Column(String, nullable=True)
    doc_no = Column(String, nullable=True)
    terminal_id = Column(String, nullable=True)
    pay_amt = Column(String, nullable=True)
    commis_amt = Column(String, nullable=True)
    tax_amt = Column(String, nullable=True)
    total = Column(String, nullable=True)
    wht_amount = Column(String, nullable=True)


# ═══════════════════════════════════════════════════
# Pydantic Schemas (API Request / Response)
# ═══════════════════════════════════════════════════

class ExtractedReceiptData(BaseModel):
    """Structured data extracted from a bank receipt/invoice."""
    bank_name: Optional[str] = Field(None, description="ชื่อธนาคาร")
    doc_name: Optional[str] = Field(None, description="ประเภทเอกสาร เช่น ใบเสร็จรับเงิน/ใบกำกับภาษี")
    company_name: Optional[str] = Field(None, description="ชื่อบริษัท/ร้านค้า")
    doc_date: Optional[str] = Field(None, description="วันที่เอกสาร")
    doc_no: Optional[str] = Field(None, description="เลขที่เอกสาร")
    terminal_id: Optional[str] = Field(None, description="Terminal ID / Merchant ID")
    pay_amt: Optional[str] = Field(None, description="ยอดชำระ (Payment Amount)")
    commis_amt: Optional[str] = Field(None, description="ค่าธรรมเนียม (Commission Amount)")
    tax_amt: Optional[str] = Field(None, description="ภาษี (Tax Amount)")
    total: Optional[str] = Field(None, description="ยอดรวมสุทธิ")
    wht_amount: Optional[str] = Field(None, description="ภาษีหัก ณ ที่จ่าย (Withholding Tax)")


class OCRTaskResponse(BaseModel):
    """Response schema for a single OCR task."""
    id: str
    filename: str
    original_filename: str
    status: TaskStatus
    ocr_engine: Optional[str] = None
    raw_text: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    extracted_data: Optional[ExtractedReceiptData] = None

    class Config:
        from_attributes = True


class OCRTaskListResponse(BaseModel):
    """Response schema for listing multiple OCR tasks."""
    total: int
    tasks: List[OCRTaskResponse]


class OCRUploadResponse(BaseModel):
    """Response immediately after uploading file(s)."""
    message: str
    task_ids: List[str]
    total_files: int


class ExportResponse(BaseModel):
    """Response for CSV export."""
    message: str
    file_path: str
    total_records: int

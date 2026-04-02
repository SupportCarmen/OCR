"""
SQLAlchemy ORM models and Pydantic schemas.

Tables:
    ocr_tasks       — file upload / processing metadata
    receipts        — document header (1 per task)
    receipt_details — line items / terminal rows (many per receipt)
"""

from datetime import datetime
from typing import Optional, List
from enum import Enum
import uuid

from pydantic import BaseModel, Field
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, Numeric
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
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


class BankType(str, Enum):
    BBL = "BBL"
    KBANK = "KBANK"
    SCB = "SCB"


# ═══════════════════════════════════════════════════
# ORM Models
# ═══════════════════════════════════════════════════

class OCRTask(Base):
    """File upload and processing metadata."""
    __tablename__ = "ocr_tasks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    status = Column(SAEnum(TaskStatus, values_callable=lambda obj: [e.value for e in obj]), default=TaskStatus.PENDING, nullable=False)
    ocr_engine = Column(String, nullable=True)
    raw_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    receipt = relationship("Receipt", back_populates="task", uselist=False)


class Receipt(Base):
    """Document header — one per OCR task."""
    __tablename__ = "receipts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String, ForeignKey("ocr_tasks.id"), nullable=False)

    # Header fields (from LLM extraction)
    bank_name = Column(String, nullable=True)
    bank_type = Column(SAEnum(BankType, values_callable=lambda obj: [e.value for e in obj]), nullable=True)   # BBL / KBANK / SCB
    doc_name = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    doc_date = Column(String, nullable=True)
    doc_no = Column(String, nullable=True, index=True)

    # Submission tracking
    submitted_at = Column(DateTime, nullable=True)        # NULL = not yet submitted
    created_at = Column(DateTime, server_default=func.now())

    task = relationship("OCRTask", back_populates="receipt")
    details = relationship("ReceiptDetail", back_populates="receipt", cascade="all, delete-orphan")


class ReceiptDetail(Base):
    """Terminal line item — many per receipt."""
    __tablename__ = "receipt_details"

    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_id = Column(String, ForeignKey("receipts.id"), nullable=False)

    terminal_id = Column(String, nullable=True)
    pay_amt = Column(Numeric(15, 2), nullable=True)
    commis_amt = Column(Numeric(15, 2), nullable=True)
    tax_amt = Column(Numeric(15, 2), nullable=True)
    wht_amount = Column(Numeric(15, 2), nullable=True)
    total = Column(Numeric(15, 2), nullable=True)

    receipt = relationship("Receipt", back_populates="details")


# ═══════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════

class ReceiptDetailSchema(BaseModel):
    terminal_id: Optional[str] = None
    pay_amt: Optional[float] = None
    commis_amt: Optional[float] = None
    tax_amt: Optional[float] = None
    wht_amount: Optional[float] = None
    total: Optional[float] = None

    class Config:
        from_attributes = True


class ReceiptSchema(BaseModel):
    id: str
    task_id: str
    bank_name: Optional[str] = None
    bank_type: Optional[BankType] = None
    doc_name: Optional[str] = None
    company_name: Optional[str] = None
    doc_date: Optional[str] = None
    doc_no: Optional[str] = None
    submitted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    details: List[ReceiptDetailSchema] = []

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


# ExtractedReceiptData — ใช้ภายในสำหรับ LLM response mapping
class ExtractedReceiptData(BaseModel):
    bank_name: Optional[str] = Field(None, description="ชื่อธนาคาร")
    doc_name: Optional[str] = Field(None, description="ประเภทเอกสาร")
    company_name: Optional[str] = Field(None, description="ชื่อบริษัท")
    doc_date: Optional[str] = Field(None, description="วันที่เอกสาร")
    doc_no: Optional[str] = Field(None, description="เลขที่เอกสาร")
    terminal_id: Optional[str] = Field(None, description="Terminal ID")
    pay_amt: Optional[str] = Field(None, description="ยอดชำระ")
    commis_amt: Optional[str] = Field(None, description="ค่าธรรมเนียม")
    tax_amt: Optional[str] = Field(None, description="ภาษี")
    total: Optional[str] = Field(None, description="ยอดรวมสุทธิ")
    wht_amount: Optional[str] = Field(None, description="ภาษีหัก ณ ที่จ่าย")

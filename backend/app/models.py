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

from pydantic import BaseModel, Field, AliasChoices
from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, Numeric, UniqueConstraint
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

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    status = Column(SAEnum(TaskStatus, values_callable=lambda obj: [e.value for e in obj]), default=TaskStatus.PENDING, nullable=False)
    ocr_engine = Column(String(100), nullable=True)
    raw_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    receipt = relationship("Receipt", back_populates="task", uselist=False)


class Receipt(Base):
    """Document header — one per OCR task."""
    __tablename__ = "receipts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id = Column(String(36), ForeignKey("ocr_tasks.id"), nullable=False)

    # Header fields (from LLM extraction)
    bank_name = Column(String(255), nullable=True)
    bank_type = Column(SAEnum(BankType, values_callable=lambda obj: [e.value for e in obj]), nullable=True)   # BBL / KBANK / SCB
    doc_name = Column(String(255), nullable=True)
    company_name = Column(String(255), nullable=True)
    company_tax_id = Column(String(50), nullable=True)
    company_address = Column(Text, nullable=True)
    account_no = Column(String(100), nullable=True)
    doc_date = Column(String(50), nullable=True)
    doc_no = Column(String(100), nullable=True, index=True)
    merchant_name = Column(String(255), nullable=True)
    merchant_id = Column(String(100), nullable=True)
    wht_rate = Column(String(20), nullable=True)
    wht_amount = Column(Numeric(15, 2), nullable=True)
    net_amount = Column(Numeric(15, 2), nullable=True)
    bank_companyname = Column(String(255), nullable=True)   # bank's own legal company name
    bank_tax_id = Column(String(50), nullable=True)         # bank's own tax ID
    bank_address = Column(Text, nullable=True)              # bank's own address
    branch_no = Column(String(50), nullable=True)           # bank's own branch number

    # Submission tracking
    submitted_at = Column(DateTime, nullable=True)        # NULL = not yet submitted
    created_at = Column(DateTime, server_default=func.now())

    task = relationship("OCRTask", back_populates="receipt")
    details = relationship("ReceiptDetail", back_populates="receipt", cascade="all, delete-orphan")


class ReceiptDetail(Base):
    """Payment item — many per receipt."""
    __tablename__ = "receipt_details"

    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_id = Column(String(36), ForeignKey("receipts.id"), nullable=False)

    transaction = Column(String(255), nullable=True)
    pay_amt = Column(Numeric(15, 2), nullable=True)
    commis_amt = Column(Numeric(15, 2), nullable=True)
    tax_amt = Column(Numeric(15, 2), nullable=True)
    wht_amount = Column(Numeric(15, 2), nullable=True)
    total = Column(Numeric(15, 2), nullable=True)

    receipt = relationship("Receipt", back_populates="details")


class MappingHistory(Base):
    """Confirmed account mapping history — one row per (bank_name, field_type)."""
    __tablename__ = "mapping_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    bank_name = Column(String(100), nullable=False, index=True)
    field_type = Column(String(100), nullable=False)   # 'commission' | 'tax' | 'net' | payment type
    dept_code = Column(String(100), nullable=True)
    acc_code = Column(String(100), nullable=True)
    confirmed_count = Column(Integer, default=1)
    updated_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("bank_name", "field_type", name="uq_mapping_bank_field"),)


# ═══════════════════════════════════════════════════
# Pydantic Schemas
# ═══════════════════════════════════════════════════

class ReceiptDetailSchema(BaseModel):
    transaction: Optional[str] = None
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
    company_tax_id: Optional[str] = None
    company_address: Optional[str] = None
    account_no: Optional[str] = None
    doc_date: Optional[str] = None
    doc_no: Optional[str] = None
    merchant_name: Optional[str] = None
    merchant_id: Optional[str] = None
    wht_rate: Optional[str] = None
    wht_amount: Optional[float] = None
    net_amount: Optional[float] = None
    bank_companyname: Optional[str] = None
    bank_tax_id: Optional[str] = None
    bank_address: Optional[str] = None
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


# ExtractedDetailRow — one line item from LLM (one per payment type / card)
class ExtractedDetailRow(BaseModel):
    transaction: Optional[str] = None   # card type / payment type label
    pay_amt: Optional[str] = None
    commis_amt: Optional[str] = None
    tax_amt: Optional[str] = None
    total: Optional[str] = None


# ExtractedReceiptData — ใช้ภายในสำหรับ LLM response mapping
class ExtractedReceiptData(BaseModel):
    bank_name: Optional[str] = Field(None, description="ชื่อธนาคาร")
    doc_name: Optional[str] = Field(None, description="ประเภทเอกสาร")
    company_name: Optional[str] = Field(None, description="ชื่อบริษัท")
    company_tax_id: Optional[str] = Field(None, description="เลขประจำตัวผู้เสียภาษีร้านค้า")
    company_address: Optional[str] = Field(None, description="ที่อยู่ร้านค้า")
    account_no: Optional[str] = Field(None, description="เลขที่บัญชีรับเงิน")
    doc_date: Optional[str] = Field(None, description="วันที่เอกสาร")
    doc_no: Optional[str] = Field(None, description="เลขที่เอกสาร")
    merchant_name: Optional[str] = Field(None, description="ชื่อร้านค้า / MERCHANT NAME จากธนาคาร")
    merchant_id: Optional[str] = Field(None, description="หมายเลขร้านค้า / MERCHANT NUMBER / Terminal ID")
    wht_rate: Optional[str] = Field(None, description="อัตราภาษีหัก ณ ที่จ่าย % เช่น '3.00'")
    wht_amount: Optional[str] = Field(None, description="ภาษีหัก ณ ที่จ่าย รวมทั้งเอกสาร (บาท)")
    net_amount: Optional[str] = Field(None, description="ยอดเงินสุทธิรวมทั้งเอกสาร (NET AMOUNT) หลังหัก WHT")
    bank_companyname: Optional[str] = Field(None, description="ชื่อนิติบุคคลของธนาคาร (เช่น ธนาคารกรุงเทพ จำกัด (มหาชน))")
    bank_tax_id: Optional[str] = Field(None, description="เลขประจำตัวผู้เสียภาษีของธนาคาร", validation_alias=AliasChoices("bank_tax_id", "back_tax_id"))
    bank_address: Optional[str] = Field(None, description="ที่อยู่ของธนาคาร (ที่อยู่สำนักงานใหญ่ที่พิมพ์บนเอกสาร)")
    branch_no: Optional[str] = Field(None, description="รหัสสาขาของธนาคาร (ถ้ามี)")
    details: List[ExtractedDetailRow] = Field(default_factory=list, description="รายการ card/payment type rows")

import uuid

from sqlalchemy import Column, String, DateTime, Text, Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from .enums import TaskStatus, BankType


class OCRTask(Base):
    """File upload and processing metadata."""
    __tablename__ = "ocr_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=True, default="N/A")
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

    bank_name = Column(String(255), nullable=True)
    bank_type = Column(SAEnum(BankType, values_callable=lambda obj: [e.value for e in obj]), nullable=True)
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
    bank_companyname = Column(String(255), nullable=True)
    bank_tax_id = Column(String(50), nullable=True)
    bank_address = Column(Text, nullable=True)
    branch_no = Column(String(50), nullable=True)

    submitted_at = Column(DateTime, nullable=True)
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
    field_type = Column(String(100), nullable=False)
    dept_code = Column(String(100), nullable=True)
    acc_code = Column(String(100), nullable=True)
    confirmed_count = Column(Integer, default=1)
    updated_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint("bank_name", "field_type", "dept_code", "acc_code", name="uq_mapping_bank_field_choice"),)


class CorrectionFeedback(Base):
    """Track user corrections to OCR extraction — for learning patterns."""
    __tablename__ = "correction_feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    receipt_id = Column(String(100), nullable=False, index=True)
    bank_type = Column(String(50), nullable=False, index=True)
    field_name = Column(String(100), nullable=False, index=True)
    original_value = Column(Text, nullable=True)
    corrected_value = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("receipt_id", "field_name", name="uq_correction_receipt_field"),
    )


class LLMUsageLog(Base):
    """Log token usage for every LLM interaction."""
    __tablename__ = "llm_usage_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(36), ForeignKey("ocr_tasks.id"), nullable=True)
    model = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    usage_type = Column(String(50), nullable=True) # e.g. OCR, AR_INVOICE, MAPPING
    created_at = Column(DateTime, server_default=func.now())

    task = relationship("OCRTask")

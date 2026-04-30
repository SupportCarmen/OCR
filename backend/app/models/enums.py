from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class BankType(str, Enum):
    BBL = "BBL"
    KBANK = "KBANK"
    SCB = "SCB"


class DocumentType(str, Enum):
    CREDIT_CARD = "CREDIT_CARD"
    AP_INVOICE = "AP_INVOICE"

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

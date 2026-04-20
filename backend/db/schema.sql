-- ============================================================
-- Bank Receipt OCR — Database Schema (MariaDB)
-- ============================================================

CREATE DATABASE IF NOT EXISTS ocr_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE ocr_db;

-- ============================================================
-- ocr_tasks — file upload and processing metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS ocr_tasks (
    id              VARCHAR(36)     NOT NULL,
    original_filename VARCHAR(255)  NOT NULL,
    file_path       VARCHAR(500)    NOT NULL,
    status          ENUM('pending','processing','completed','failed')
                                    NOT NULL DEFAULT 'pending',
    ocr_engine      VARCHAR(100)    NULL,
    raw_text        LONGTEXT        NULL,
    error_message   TEXT            NULL,
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    DATETIME        NULL,

    PRIMARY KEY (id),
    INDEX idx_ocr_tasks_status (status),
    INDEX idx_ocr_tasks_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- receipts — document header (1 per task)
-- ============================================================

CREATE TABLE IF NOT EXISTS receipts (
    id              VARCHAR(36)     NOT NULL,
    task_id         VARCHAR(36)     NOT NULL,

    -- Basic header fields
    bank_name       VARCHAR(255)    NULL,
    bank_type       ENUM('BBL','KBANK','SCB') NULL,
    doc_name        VARCHAR(255)    NULL,
    company_name    VARCHAR(255)    NULL,
    company_tax_id  VARCHAR(50)     NULL        COMMENT 'เลขประจำตัวผู้เสียภาษี',
    company_address TEXT            NULL        COMMENT 'ที่อยู่ร้านค้า',
    account_no      VARCHAR(100)    NULL        COMMENT 'เลขที่บัญชีรับเงิน',
    doc_date        VARCHAR(20)     NULL        COMMENT 'DD/MM/YYYY as extracted from document',
    doc_no          VARCHAR(100)    NULL,

    -- Merchant fields
    merchant_name   VARCHAR(255)    NULL        COMMENT 'MERCHANT NAME จากธนาคาร',
    merchant_id     VARCHAR(100)    NULL        COMMENT 'MERCHANT NUMBER / หมายเลขร้านค้า',

    -- WHT / Net fields (document-level)
    wht_rate        VARCHAR(20)     NULL        COMMENT 'อัตราภาษีหัก ณ ที่จ่าย เช่น 3.00',
    wht_amount      DECIMAL(15,2)   NULL        COMMENT 'ภาษีหัก ณ ที่จ่าย รวมทั้งเอกสาร (บาท)',
    net_amount      DECIMAL(15,2)   NULL        COMMENT 'ยอดเงินสุทธิรวมทั้งเอกสาร หลังหัก WHT',
    bank_companyname VARCHAR(255)   NULL        COMMENT 'ชื่อนิติบุคคลของธนาคาร',
    bank_tax_id     VARCHAR(50)     NULL        COMMENT 'เลขประจำตัวผู้เสียภาษีธนาคาร',
    bank_address    TEXT            NULL        COMMENT 'ที่อยู่ธนาคาร',
    branch_no       VARCHAR(50)     NULL        COMMENT 'รหัสสาขาธนาคาร',

    -- Submission tracking
    submitted_at    DATETIME        NULL        COMMENT 'NULL = not yet submitted',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_receipts_task
        FOREIGN KEY (task_id) REFERENCES ocr_tasks(id)
        ON DELETE CASCADE,
    INDEX idx_receipts_task_id (task_id),
    INDEX idx_receipts_doc_no (doc_no),
    INDEX idx_receipts_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- receipt_details — payment type line items (many per receipt)
-- ============================================================

CREATE TABLE IF NOT EXISTS receipt_details (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    receipt_id      VARCHAR(36)     NOT NULL,
    transaction     VARCHAR(255)    NULL        COMMENT 'card type / payment type label',
    pay_amt         DECIMAL(15,2)   NULL,
    commis_amt      DECIMAL(15,2)   NULL,
    tax_amt         DECIMAL(15,2)   NULL,
    wht_amount      DECIMAL(15,2)   NULL,
    total           DECIMAL(15,2)   NULL,

    PRIMARY KEY (id),
    CONSTRAINT fk_receipt_details_receipt
        FOREIGN KEY (receipt_id) REFERENCES receipts(id)
        ON DELETE CASCADE,
    INDEX idx_receipt_details_receipt_id (receipt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- mapping_history — account mapping history (bank_name, field_type)
-- ============================================================

CREATE TABLE IF NOT EXISTS mapping_history (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    bank_name       VARCHAR(100)    NOT NULL,
    field_type      VARCHAR(100)    NOT NULL,
    dept_code       VARCHAR(100)    NULL,
    acc_code        VARCHAR(100)    NULL,
    confirmed_count INT UNSIGNED    DEFAULT 1,
    updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_mapping_bank_field (bank_name, field_type),
    INDEX idx_mapping_history_bank (bank_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- correction_feedback — user corrections for OCR learning
-- ============================================================

CREATE TABLE IF NOT EXISTS correction_feedback (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    receipt_id      VARCHAR(100)    NOT NULL                COMMENT 'stores doc_no',
    bank_type       VARCHAR(50)     NOT NULL,
    field_name      VARCHAR(100)    NOT NULL                COMMENT 'snake_case field names matching LLM prompt',
    original_value  TEXT            NULL        COMMENT 'LLM extracted value',
    corrected_value TEXT            NULL        COMMENT 'User corrected value',
    created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_correction_receipt_field (receipt_id, field_name),
    INDEX idx_correction_bank_type (bank_type),
    INDEX idx_correction_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    bank_name       VARCHAR(255)    NULL,
    bank_type       ENUM('BBL','KBANK','SCB') NULL,
    doc_name        VARCHAR(255)    NULL,
    company_name    VARCHAR(255)    NULL,
    doc_date        VARCHAR(20)     NULL        COMMENT 'DD/MM/YYYY as extracted from document',
    doc_no          VARCHAR(100)    NULL,
    submitted_at    DATETIME        NULL        COMMENT 'NULL = not yet submitted to Carmen',
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
-- receipt_details — terminal line items (many per receipt)
-- ============================================================

CREATE TABLE IF NOT EXISTS receipt_details (
    id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    receipt_id      VARCHAR(36)     NOT NULL,
    terminal_id     VARCHAR(100)    NULL,
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

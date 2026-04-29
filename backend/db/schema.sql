-- ============================================================
-- Bank Receipt OCR — Database Schema (MariaDB)
-- Generated from ORM state — do NOT edit manually.
-- Use migrations in app/database.py to evolve this schema.
-- ============================================================

CREATE DATABASE IF NOT EXISTS ocr_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE ocr_db;

-- ============================================================
-- schema_migrations — tracks applied migrations
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    name       VARCHAR(100) PRIMARY KEY,
    applied_at DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- ocr_tasks — file upload and processing metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS ocr_tasks (
    id                VARCHAR(36)   NOT NULL,
    original_filename VARCHAR(255)  NOT NULL,
    file_path         VARCHAR(512)  NULL,
    status            ENUM('pending','processing','completed','failed')
                                    NOT NULL DEFAULT 'pending',
    ocr_engine        VARCHAR(100)  NULL,
    error_message     TEXT          NULL,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at      DATETIME      NULL,

    PRIMARY KEY (id),
    INDEX idx_ocr_tasks_status (status),
    INDEX idx_ocr_tasks_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- receipts — document header (1 per task)
-- ============================================================

CREATE TABLE IF NOT EXISTS receipts (
    id               VARCHAR(36)   NOT NULL,
    task_id          VARCHAR(36)   NOT NULL,
    tenant           VARCHAR(100)  NULL,

    bank_name        VARCHAR(255)  NULL,
    bank_type        ENUM('BBL','KBANK','SCB') NULL,
    doc_name         VARCHAR(255)  NULL,
    company_name     VARCHAR(255)  NULL,
    doc_date         VARCHAR(20)   NULL        COMMENT 'DD/MM/YYYY',
    doc_no           VARCHAR(100)  NULL,
    merchant_name    VARCHAR(255)  NULL,
    bank_companyname VARCHAR(255)  NULL,
    branch_no        VARCHAR(50)   NULL,
    transactions     JSON          NULL        COMMENT '["Visa","Master",...]',

    submitted_at     DATETIME      NULL        COMMENT 'NULL = pending',
    created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_receipts_task FOREIGN KEY (task_id) REFERENCES ocr_tasks(id) ON DELETE CASCADE,
    INDEX idx_receipts_task_id (task_id),
    INDEX idx_receipts_tenant (tenant),
    INDEX idx_receipts_doc_no (doc_no),
    INDEX idx_receipts_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- mapping_history — confirmed GL account mappings per tenant
-- ============================================================

CREATE TABLE IF NOT EXISTS mapping_history (
    id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    tenant          VARCHAR(100)  NULL,
    bank_name       VARCHAR(100)  NOT NULL,
    field_type      VARCHAR(100)  NOT NULL,
    dept_code       VARCHAR(100)  NULL,
    acc_code        VARCHAR(100)  NULL,
    confirmed_count INT UNSIGNED  DEFAULT 1,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_mapping_tenant_bank_field_choice (tenant, bank_name, field_type, dept_code, acc_code),
    INDEX idx_mapping_tenant (tenant),
    INDEX idx_mapping_bank (bank_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- llm_usage_logs — token usage per LLM call
-- ============================================================

CREATE TABLE IF NOT EXISTS llm_usage_logs (
    id                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    task_id           VARCHAR(36)   NULL        COMMENT 'FK to ocr_tasks, nullable for mapping/AP calls',
    usage_type        VARCHAR(50)   NULL        COMMENT 'BANK_OCR | AP_INVOICE | MAPPING_SUGGESTION | AP_GL_SUGGESTION',
    model             VARCHAR(100)  NOT NULL,
    prompt_tokens     INT           NOT NULL DEFAULT 0,
    completion_tokens INT           NOT NULL DEFAULT 0,
    total_tokens      INT           NOT NULL DEFAULT 0,
    session_id        VARCHAR(36)   NULL,
    user_id           VARCHAR(100)  NULL,
    bu_name           VARCHAR(100)  NULL,
    tenant            VARCHAR(100)  NULL,
    created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    CONSTRAINT fk_llm_usage_logs_task FOREIGN KEY (task_id) REFERENCES ocr_tasks(id) ON DELETE SET NULL,
    INDEX idx_llm_usage_task_id (task_id),
    INDEX idx_llm_usage_session (session_id),
    INDEX idx_llm_usage_user (user_id),
    INDEX idx_llm_usage_bu (bu_name),
    INDEX idx_llm_tenant (tenant),
    INDEX idx_llm_usage_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- correction_feedback — user corrections for OCR learning
-- ============================================================

CREATE TABLE IF NOT EXISTS correction_feedback (
    id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    tenant          VARCHAR(100)  NULL,
    receipt_id      VARCHAR(100)  NOT NULL  COMMENT 'stores doc_no',
    bank_type       VARCHAR(50)   NOT NULL,
    field_name      VARCHAR(100)  NOT NULL,
    original_value  TEXT          NULL,
    corrected_value TEXT          NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_correction_receipt_field (receipt_id, field_name),
    INDEX idx_feedback_tenant (tenant),
    INDEX idx_feedback_bank_type (bank_type),
    INDEX idx_feedback_field_name (field_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- ocr_sessions — authenticated sessions (Carmen SSO)
-- ============================================================

CREATE TABLE IF NOT EXISTS ocr_sessions (
    id                     VARCHAR(36)  NOT NULL,
    carmen_token_encrypted TEXT         NOT NULL  COMMENT 'Fernet-encrypted Carmen token',
    tenant                 VARCHAR(100) NULL,
    user_id                VARCHAR(100) NULL,
    username               VARCHAR(100) NULL,
    bu                     VARCHAR(100) NULL,
    is_active              TINYINT(1)   NOT NULL DEFAULT 1,
    created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at           DATETIME     NULL,

    PRIMARY KEY (id),
    INDEX idx_session_tenant (tenant),
    INDEX idx_session_user (user_id),
    INDEX idx_session_bu (bu),
    INDEX idx_session_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- audit_logs — user action trail
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    tenant       VARCHAR(100) NULL,
    user_id      VARCHAR(100) NULL,
    username     VARCHAR(100) NULL,
    bu           VARCHAR(100) NULL,
    action       VARCHAR(50)  NOT NULL  COMMENT 'EXTRACT | SUBMIT | SUGGEST_GL | EXPORT | LOGIN | LOGOUT',
    resource     VARCHAR(50)  NULL      COMMENT 'CREDIT_CARD | AP_INVOICE',
    document_ref VARCHAR(255) NULL,
    ip_address   VARCHAR(45)  NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_audit_tenant (tenant),
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- performance_logs — API request latency
-- ============================================================

CREATE TABLE IF NOT EXISTS performance_logs (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    endpoint     VARCHAR(200) NOT NULL,
    method       VARCHAR(10)  NULL,
    duration_ms  DOUBLE       NOT NULL,
    status_code  INT          NULL,
    user_id      VARCHAR(100) NULL,
    document_ref VARCHAR(255) NULL,
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_perf_endpoint (endpoint),
    INDEX idx_perf_user (user_id),
    INDEX idx_perf_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- outbound_call_logs — every HTTP call to OpenRouter / Carmen
-- ============================================================

CREATE TABLE IF NOT EXISTS outbound_call_logs (
    id                   BIGINT       NOT NULL AUTO_INCREMENT,
    service              VARCHAR(50)  NOT NULL  COMMENT 'openrouter | carmen',
    url                  VARCHAR(500) NOT NULL,
    method               VARCHAR(10)  NULL,
    status_code          INT          NULL,
    duration_ms          DOUBLE       NULL,
    request_size_bytes   INT          NULL,
    session_id           VARCHAR(36)  NULL,
    user_id              VARCHAR(100) NULL,
    created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    INDEX idx_outbound_service (service),
    INDEX idx_outbound_session (session_id),
    INDEX idx_outbound_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

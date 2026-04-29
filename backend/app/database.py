"""
Database setup — async MySQL/MariaDB via SQLAlchemy.

Migration strategy: lightweight versioned runner (no Alembic dependency).
Each migration function is registered in _MIGRATIONS with a unique name.
Applied migrations are recorded in `schema_migrations` so each runs exactly once.
"""

import logging
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker, AsyncConnection
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def init_db():
    """Create all ORM-declared tables if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# ── Migration functions ────────────────────────────────────────────────────────

async def _m001_receipt_columns(conn):
    cols = [
        ("company_tax_id", "VARCHAR(50)"),
        ("company_address", "TEXT"),
        ("account_no",      "VARCHAR(100)"),
        ("merchant_name",   "VARCHAR(255)"),
        ("merchant_id",     "VARCHAR(100)"),
        ("wht_rate",        "VARCHAR(20)"),
        ("wht_amount",      "NUMERIC(15,2)"),
        ("net_amount",      "NUMERIC(15,2)"),
    ]
    for col, col_type in cols:
        try:
            await conn.execute(text(f"ALTER TABLE receipts ADD COLUMN {col} {col_type}"))
            logger.info(f"  + receipts.{col}")
        except Exception:
            pass  # already exists — MySQL raises 1060


async def _m002_ocr_tasks_nullable(conn):
    await conn.execute(text("ALTER TABLE ocr_tasks MODIFY file_path VARCHAR(512) NULL"))


async def _m003_llm_usage_columns(conn):
    for col, defn in [
        ("usage_type", "VARCHAR(50) NULL AFTER task_id"),
        ("token_hash", "VARCHAR(64) NULL"),
        ("bu_name",    "VARCHAR(100) NULL"),
        ("session_id", "VARCHAR(36) NULL"),
        ("user_id",    "VARCHAR(100) NULL"),
    ]:
        try:
            await conn.execute(text(f"ALTER TABLE llm_usage_logs ADD COLUMN {col} {defn}"))
            logger.info(f"  + llm_usage_logs.{col}")
        except Exception:
            pass


async def _m004_mapping_history_constraint(conn):
    try:
        await conn.execute(text("ALTER TABLE mapping_history DROP INDEX uq_mapping_bank_field"))
    except Exception:
        pass
    try:
        await conn.execute(text(
            "ALTER TABLE mapping_history ADD CONSTRAINT uq_mapping_bank_field_choice "
            "UNIQUE (bank_name, field_type, dept_code, acc_code)"
        ))
    except Exception:
        pass


async def _m005_create_audit_logs(conn):
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id           BIGINT       AUTO_INCREMENT PRIMARY KEY,
            user_id      VARCHAR(100) NULL,
            username     VARCHAR(100) NULL,
            bu           VARCHAR(100) NULL,
            action       VARCHAR(50)  NOT NULL,
            resource     VARCHAR(50)  NULL,
            document_ref VARCHAR(255) NULL,
            ip_address   VARCHAR(45)  NULL,
            created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_audit_user   (user_id),
            INDEX idx_audit_action (action, created_at),
            INDEX idx_audit_date   (created_at)
        )
    """))


async def _m006_create_performance_logs(conn):
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS performance_logs (
            id           BIGINT       AUTO_INCREMENT PRIMARY KEY,
            endpoint     VARCHAR(200) NOT NULL,
            method       VARCHAR(10)  NULL,
            duration_ms  DOUBLE       NOT NULL,
            status_code  INT          NULL,
            user_id      VARCHAR(100) NULL,
            document_ref VARCHAR(255) NULL,
            created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_perf_endpoint (endpoint, created_at),
            INDEX idx_perf_user     (user_id),
            INDEX idx_perf_date     (created_at)
        )
    """))


async def _m007_create_outbound_call_logs(conn):
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS outbound_call_logs (
            id                 BIGINT       AUTO_INCREMENT PRIMARY KEY,
            service            VARCHAR(50)  NOT NULL,
            url                VARCHAR(500) NOT NULL,
            method             VARCHAR(10)  NULL,
            status_code        INT          NULL,
            duration_ms        DOUBLE       NULL,
            request_size_bytes INT          NULL,
            session_id         VARCHAR(36)  NULL,
            user_id            VARCHAR(100) NULL,
            created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_outbound_service (service, created_at),
            INDEX idx_outbound_session (session_id)
        )
    """))


async def _m013_add_tenant(conn):
    """Add tenant to all tenant-scoped tables for multi-tenant isolation."""
    changes = [
        ("ocr_sessions",       "tenant VARCHAR(100) NULL AFTER id"),
        ("receipts",           "tenant VARCHAR(100) NULL AFTER task_id"),
        ("mapping_history",    "tenant VARCHAR(100) NULL AFTER id"),
        ("correction_feedback","tenant VARCHAR(100) NULL AFTER id"),
        ("llm_usage_logs",     "tenant VARCHAR(100) NULL"),
        ("audit_logs",         "tenant VARCHAR(100) NULL AFTER id"),
    ]
    for table, defn in changes:
        try:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {defn}"))
            logger.info(f"  + {table}.tenant")
        except Exception:
            pass  # already exists

    # Indexes for fast per-tenant queries
    indexes = [
        ("receipts",           "idx_receipts_tenant",     "tenant"),
        ("mapping_history",    "idx_mapping_tenant",      "tenant"),
        ("correction_feedback","idx_feedback_tenant",     "tenant"),
        ("llm_usage_logs",     "idx_llm_tenant",          "tenant"),
        ("audit_logs",         "idx_audit_tenant",        "tenant"),
    ]
    for table, idx_name, col in indexes:
        try:
            await conn.execute(text(f"ALTER TABLE {table} ADD INDEX {idx_name} ({col})"))
            logger.info(f"  + {table}.{idx_name}")
        except Exception:
            pass

    # Update mapping_history unique constraint to include tenant
    try:
        await conn.execute(text("ALTER TABLE mapping_history DROP INDEX uq_mapping_bank_field_choice"))
    except Exception:
        pass
    try:
        await conn.execute(text(
            "ALTER TABLE mapping_history ADD CONSTRAINT uq_mapping_tenant_bank_field_choice "
            "UNIQUE (tenant, bank_name, field_type, dept_code, acc_code)"
        ))
        logger.info("  + mapping_history.uq_mapping_tenant_bank_field_choice")
    except Exception:
        pass


async def _m014_schema_cleanup_and_analytics(conn):
    """Drop unused columns, add analytics columns, rename correction_feedback.receipt_id."""

    # 1. DROP ocr_tasks.file_path
    try:
        await conn.execute(text("ALTER TABLE ocr_tasks DROP COLUMN file_path"))
        logger.info("  - ocr_tasks.file_path")
    except Exception:
        pass

    # 2. ADD ocr_tasks.tenant
    try:
        await conn.execute(text("ALTER TABLE ocr_tasks ADD COLUMN tenant VARCHAR(100) NULL AFTER original_filename"))
        await conn.execute(text("ALTER TABLE ocr_tasks ADD INDEX idx_ocr_tasks_tenant (tenant)"))
        logger.info("  + ocr_tasks.tenant")
    except Exception:
        pass

    # 3. ADD llm_usage_logs.duration_ms + cost_usd
    for col, defn in [
        ("duration_ms", "DOUBLE NULL AFTER total_tokens"),
        ("cost_usd",    "DECIMAL(10,6) NULL AFTER duration_ms"),
    ]:
        try:
            await conn.execute(text(f"ALTER TABLE llm_usage_logs ADD COLUMN {col} {defn}"))
            logger.info(f"  + llm_usage_logs.{col}")
        except Exception:
            pass

    # 4. ADD audit_logs.session_id
    try:
        await conn.execute(text("ALTER TABLE audit_logs ADD COLUMN session_id VARCHAR(36) NULL AFTER tenant"))
        await conn.execute(text("ALTER TABLE audit_logs ADD INDEX idx_audit_session (session_id)"))
        logger.info("  + audit_logs.session_id")
    except Exception:
        pass

    # 5. ADD performance_logs.tenant
    try:
        await conn.execute(text("ALTER TABLE performance_logs ADD COLUMN tenant VARCHAR(100) NULL AFTER id"))
        await conn.execute(text("ALTER TABLE performance_logs ADD INDEX idx_perf_tenant (tenant)"))
        logger.info("  + performance_logs.tenant")
    except Exception:
        pass

    # 6. ADD outbound_call_logs.tenant
    try:
        await conn.execute(text("ALTER TABLE outbound_call_logs ADD COLUMN tenant VARCHAR(100) NULL AFTER id"))
        await conn.execute(text("ALTER TABLE outbound_call_logs ADD INDEX idx_outbound_tenant (tenant)"))
        logger.info("  + outbound_call_logs.tenant")
    except Exception:
        pass

    # 7. ADD correction_feedback.user_id
    try:
        await conn.execute(text("ALTER TABLE correction_feedback ADD COLUMN user_id VARCHAR(100) NULL"))
        await conn.execute(text("ALTER TABLE correction_feedback ADD INDEX idx_feedback_user (user_id)"))
        logger.info("  + correction_feedback.user_id")
    except Exception:
        pass

    # 8. RENAME correction_feedback.receipt_id → doc_no
    try:
        await conn.execute(text("ALTER TABLE correction_feedback CHANGE COLUMN receipt_id doc_no VARCHAR(100) NOT NULL"))
        logger.info("  ~ correction_feedback.receipt_id → doc_no")
    except Exception:
        pass
    # Update unique constraint
    try:
        await conn.execute(text("ALTER TABLE correction_feedback DROP INDEX uq_correction_receipt_field"))
    except Exception:
        pass
    try:
        await conn.execute(text(
            "ALTER TABLE correction_feedback ADD CONSTRAINT uq_correction_doc_field "
            "UNIQUE (doc_no, field_name)"
        ))
        logger.info("  + correction_feedback.uq_correction_doc_field")
    except Exception:
        pass


async def _m012_drop_session_expires_at(conn):
    """Drop ocr_sessions.expires_at + its composite index.
    JWT exp + Carmen 401 deactivation now cover everything this column did."""
    try:
        await conn.execute(text("ALTER TABLE ocr_sessions DROP INDEX idx_session_active_exp"))
        logger.info("  - ocr_sessions.idx_session_active_exp")
    except Exception:
        pass
    try:
        await conn.execute(text("ALTER TABLE ocr_sessions DROP COLUMN expires_at"))
        logger.info("  - ocr_sessions.expires_at")
    except Exception:
        pass


async def _m011_merge_receipt_details_into_transactions(conn):
    """Add receipts.transactions JSON column and drop the receipt_details table."""
    try:
        await conn.execute(text("ALTER TABLE receipts ADD COLUMN transactions JSON NULL"))
        logger.info("  + receipts.transactions")
    except Exception:
        pass  # already exists
    try:
        await conn.execute(text("DROP TABLE IF EXISTS receipt_details"))
        logger.info("  - receipt_details")
    except Exception:
        pass


async def _m010_drop_sensitive_receipt_columns(conn):
    """Drop PII / amount columns from receipts that we no longer persist."""
    cols = [
        "company_tax_id",
        "company_address",
        "account_no",
        "merchant_id",
        "wht_rate",
        "wht_amount",
        "net_amount",
        "bank_tax_id",
        "bank_address",
    ]
    for col in cols:
        try:
            await conn.execute(text(f"ALTER TABLE receipts DROP COLUMN {col}"))
            logger.info(f"  - receipts.{col}")
        except Exception:
            pass  # column already absent


async def _m009_drop_llm_usage_token_hash(conn):
    """Drop unused token_hash column (and its index) from llm_usage_logs."""
    try:
        await conn.execute(text("ALTER TABLE llm_usage_logs DROP INDEX idx_llm_usage_token_hash"))
        logger.info("  - llm_usage_logs.idx_llm_usage_token_hash")
    except Exception:
        pass
    try:
        await conn.execute(text("ALTER TABLE llm_usage_logs DROP COLUMN token_hash"))
        logger.info("  - llm_usage_logs.token_hash")
    except Exception:
        pass


async def _m008_create_ocr_sessions(conn):
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS ocr_sessions (
            id                      VARCHAR(36)  PRIMARY KEY,
            carmen_token_encrypted  TEXT         NOT NULL,
            user_id                 VARCHAR(100) NULL,
            username                VARCHAR(100) NULL,
            bu                      VARCHAR(100) NULL,
            is_active               TINYINT(1)   NOT NULL DEFAULT 1,
            created_at              DATETIME     DEFAULT CURRENT_TIMESTAMP,
            expires_at              DATETIME     NULL,
            last_used_at            DATETIME     NULL,
            INDEX idx_session_user       (user_id),
            INDEX idx_session_bu         (bu),
            INDEX idx_session_active_exp (is_active, expires_at)
        )
    """))


async def _m015_create_daily_usage_summary(conn):
    """Create daily_usage_summary table for pre-aggregated analytics."""
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS daily_usage_summary (
            id                   INT          AUTO_INCREMENT PRIMARY KEY,
            tenant               VARCHAR(100) NOT NULL,
            summary_date         DATE         NOT NULL,
            total_documents      INT          DEFAULT 0,
            total_submissions    INT          DEFAULT 0,
            total_llm_calls      INT          DEFAULT 0,
            total_tokens         BIGINT       DEFAULT 0,
            total_cost_usd       DECIMAL(12,4) DEFAULT 0,
            avg_llm_latency_ms   DOUBLE       DEFAULT 0,
            total_api_calls      INT          DEFAULT 0,
            avg_api_latency_ms   DOUBLE       DEFAULT 0,
            p95_api_latency_ms   DOUBLE       DEFAULT 0,
            total_errors         INT          DEFAULT 0,
            total_corrections    INT          DEFAULT 0,
            total_outbound_calls INT          DEFAULT 0,
            created_at           DATETIME     DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_tenant_date (tenant, summary_date),
            INDEX idx_summary_tenant (tenant),
            INDEX idx_summary_date (summary_date)
        )
    """))
    logger.info("  + daily_usage_summary")


async def _m016_partition_log_tables(conn):
    """Partition performance_logs and outbound_call_logs by quarter.

    MariaDB requires the partition column to be part of the PRIMARY KEY,
    so we first rebuild the PK to include created_at, then add partitions.
    """
    for table in ("performance_logs", "outbound_call_logs"):
        try:
            # Check if already partitioned
            result = await conn.execute(text("""
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.PARTITIONS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = :table
                  AND PARTITION_NAME IS NOT NULL
            """), {"table": table})
            if result.scalar() > 0:
                logger.info("  ~ %s already partitioned — skipping", table)
                continue

            # Rebuild PK to include created_at (required for RANGE partitioning)
            await conn.execute(text(f"""
                ALTER TABLE {table}
                    DROP PRIMARY KEY,
                    ADD PRIMARY KEY (id, created_at)
            """))

            # Add quarterly partitions
            await conn.execute(text(f"""
                ALTER TABLE {table}
                PARTITION BY RANGE (TO_DAYS(created_at)) (
                    PARTITION p_before_2026 VALUES LESS THAN (TO_DAYS('2026-01-01')),
                    PARTITION p2026q1 VALUES LESS THAN (TO_DAYS('2026-04-01')),
                    PARTITION p2026q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
                    PARTITION p2026q3 VALUES LESS THAN (TO_DAYS('2026-10-01')),
                    PARTITION p2026q4 VALUES LESS THAN (TO_DAYS('2027-01-01')),
                    PARTITION p_future VALUES LESS THAN MAXVALUE
                )
            """))
            logger.info("  + %s partitioned by quarter", table)
        except Exception as exc:
            logger.error("  ! %s partition failed: %s", table, exc)
            # Non-fatal — table still works without partitions


async def _m017_create_model_pricing(conn: AsyncConnection):
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS model_pricing (
            model_name            VARCHAR(255) PRIMARY KEY,
            input_price_per_1m    DECIMAL(18,9) DEFAULT 0,
            output_price_per_1m   DECIMAL(18,9) DEFAULT 0,
            source                VARCHAR(50) DEFAULT 'manual',
            price_verified_at     DATETIME,
            updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    """))


async def _m018_create_ap_invoice_tables(conn: AsyncConnection):
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS ap_invoices (
            id              VARCHAR(36) PRIMARY KEY,
            task_id         VARCHAR(36),
            tenant          VARCHAR(100) NOT NULL,
            user_id         VARCHAR(36),
            vendor_name     VARCHAR(255),
            doc_no          VARCHAR(100),
            doc_date        VARCHAR(50),
            original_filename VARCHAR(255),
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ap_tenant (tenant),
            INDEX idx_ap_task (task_id),
            FOREIGN KEY (task_id) REFERENCES ocr_tasks(id)
        )
    """))


async def _m019_rename_receipts_to_credit_cards(conn: AsyncConnection):
    # Check if receipts exists
    result = await conn.execute(text("SHOW TABLES LIKE 'receipts'"))
    if result.fetchone():
        # Check if credit_cards also exists (e.g. created by init_db/create_all)
        res_cc = await conn.execute(text("SHOW TABLES LIKE 'credit_cards'"))
        if res_cc.fetchone():
            # Only drop if empty to be safe
            count_res = await conn.execute(text("SELECT COUNT(*) FROM credit_cards"))
            if count_res.scalar() == 0:
                await conn.execute(text("DROP TABLE credit_cards"))
                logger.info("Dropped empty credit_cards table to allow rename")
            else:
                logger.warning("credit_cards table already exists and has data. Skipping rename.")
                return
        
        await conn.execute(text("RENAME TABLE receipts TO credit_cards"))
        logger.info("Renamed table receipts to credit_cards")


# ── Registry: (unique_name, callable) — append only, never reorder ────────────

_MIGRATIONS = [
    ("001_receipt_columns",          _m001_receipt_columns),
    ("002_ocr_tasks_nullable",       _m002_ocr_tasks_nullable),
    ("003_llm_usage_columns",        _m003_llm_usage_columns),
    ("004_mapping_history_constraint", _m004_mapping_history_constraint),
    ("005_create_audit_logs",        _m005_create_audit_logs),
    ("006_create_performance_logs",  _m006_create_performance_logs),
    ("007_create_outbound_call_logs", _m007_create_outbound_call_logs),
    ("008_create_ocr_sessions",      _m008_create_ocr_sessions),
    ("009_drop_llm_usage_token_hash", _m009_drop_llm_usage_token_hash),
    ("010_drop_sensitive_receipt_columns", _m010_drop_sensitive_receipt_columns),
    ("011_merge_receipt_details_into_transactions", _m011_merge_receipt_details_into_transactions),
    ("012_drop_session_expires_at", _m012_drop_session_expires_at),
    ("013_add_tenant", _m013_add_tenant),
    ("014_schema_cleanup_and_analytics", _m014_schema_cleanup_and_analytics),
    ("015_create_daily_usage_summary", _m015_create_daily_usage_summary),
    ("016_partition_log_tables", _m016_partition_log_tables),
    ("017_create_model_pricing", _m017_create_model_pricing),
    ("018_create_ap_invoice_tables", _m018_create_ap_invoice_tables),
    ("019_rename_receipts_to_credit_cards", _m019_rename_receipts_to_credit_cards),
]


async def migrate_db():
    """Run pending migrations and record each in schema_migrations."""
    async with engine.begin() as conn:
        # Ensure the tracking table exists
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name       VARCHAR(100) PRIMARY KEY,
                applied_at DATETIME     DEFAULT CURRENT_TIMESTAMP
            )
        """))

        rows = await conn.execute(text("SELECT name FROM schema_migrations"))
        applied = {row[0] for row in rows.fetchall()}

        for name, fn in _MIGRATIONS:
            if name in applied:
                continue
            logger.info(f"Applying migration: {name}")
            try:
                await fn(conn)
                await conn.execute(
                    text("INSERT INTO schema_migrations (name) VALUES (:name)"),
                    {"name": name},
                )
                logger.info(f"Migration {name} applied.")
            except Exception as exc:
                logger.error(f"Migration {name} FAILED: {exc}")
                raise


async def get_db() -> AsyncSession:
    """Dependency: yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

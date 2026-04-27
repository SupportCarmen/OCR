"""
Database setup — async MySQL/MariaDB via SQLAlchemy.

Migration strategy: lightweight versioned runner (no Alembic dependency).
Each migration function is registered in _MIGRATIONS with a unique name.
Applied migrations are recorded in `schema_migrations` so each runs exactly once.
"""

import logging
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
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

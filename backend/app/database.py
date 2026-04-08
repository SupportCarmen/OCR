"""
Database setup — async MySQL/MariaDB via SQLAlchemy.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from app.config import settings


engine = create_async_engine(
    settings.database_url,
    echo=False,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all DB models."""
    pass


async def init_db():
    """Create all tables if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


_NEW_RECEIPT_COLUMNS = [
    ("company_tax_id", "VARCHAR(50)"),
    ("company_address", "TEXT"),
    ("account_no",      "VARCHAR(100)"),
    ("merchant_name",   "VARCHAR(255)"),
    ("merchant_id",     "VARCHAR(100)"),
    ("wht_rate",        "VARCHAR(20)"),
    ("wht_amount",      "NUMERIC(15,2)"),
    ("net_amount",      "NUMERIC(15,2)"),
]

async def migrate_db():
    """Add new columns to existing tables (safe, idempotent).

    This handles schema evolution for receipts table. Other tables are created
    by init_db() via Base.metadata.create_all().
    """
    async with engine.begin() as conn:
        # receipts table columns — add if not exist
        for col, col_type in _NEW_RECEIPT_COLUMNS:
            try:
                # MySQL: use SHOW COLUMNS; SQLite: use PRAGMA table_info
                # For compatibility, just try to add and catch the error
                await conn.execute(text(f"ALTER TABLE receipts ADD COLUMN {col} {col_type}"))
            except Exception:
                pass  # Column already exists — skip (works for both MySQL and SQLite)


async def get_db() -> AsyncSession:
    """Dependency: yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

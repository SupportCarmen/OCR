import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

async def migrate():
    """Migrate MariaDB to add missing columns and tables."""
    logger.info(f"Connecting to database: {settings.database_url}")
    
    # Use the same engine setup as the app
    engine = create_async_engine(settings.database_url)
    
    async with engine.begin() as conn:
        # 1. Add missing columns to 'receipts'
        columns_to_add = [
            ("bank_companyname", "VARCHAR(255) COMMENT 'ชื่อนิติบุคคลของธนาคาร'"),
            ("bank_tax_id",      "VARCHAR(50)  COMMENT 'เลขประจำตัวผู้เสียภาษีธนาคาร'"),
            ("bank_address",     "TEXT         COMMENT 'ที่อยู่ธนาคาร'"),
            ("branch_no",        "VARCHAR(50)  COMMENT 'รหัสสาขาธนาคาร'")
        ]
        
        for col_name, col_def in columns_to_add:
            try:
                # Check if column exists first (MariaDB way)
                check_query = text(f"SHOW COLUMNS FROM receipts LIKE '{col_name}'")
                result = await conn.execute(check_query)
                if result.fetchone() is None:
                    logger.info(f"Adding column '{col_name}' to 'receipts' table...")
                    await conn.execute(text(f"ALTER TABLE receipts ADD COLUMN {col_name} {col_def}"))
                else:
                    logger.info(f"Column '{col_name}' already exists in 'receipts'.")
            except Exception as e:
                logger.error(f"Error processing column {col_name}: {e}")

        # 2. Create 'mapping_history' table if not exists
        try:
            logger.info("Ensuring 'mapping_history' table exists...")
            await conn.execute(text("""
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
            """))
            logger.info("Table 'mapping_history' is ready.")
        except Exception as e:
            logger.error(f"Error creating mapping_history table: {e}")

    await engine.dispose()
    logger.info("Migration completed.")

if __name__ == "__main__":
    asyncio.run(migrate())

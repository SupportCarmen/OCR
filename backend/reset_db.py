#!/usr/bin/env python3
"""Reset MariaDB database for OCR system."""

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

async def reset_database():
    """Drop and recreate ocr_db database."""
    # Connect to MariaDB server (without specifying database)
    engine = create_async_engine(
        "mysql+aiomysql://root:123456@localhost:3306",
        echo=True
    )

    async with engine.begin() as conn:
        # Drop existing database
        await conn.execute(text("DROP DATABASE IF EXISTS ocr_db"))
        print("[OK] Dropped existing ocr_db database")

        # Create new database
        await conn.execute(text("CREATE DATABASE ocr_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
        print("[OK] Created new ocr_db database")

    await engine.dispose()
    print("\n[SUCCESS] Database reset complete. Restart the backend to create tables.")

if __name__ == "__main__":
    asyncio.run(reset_database())

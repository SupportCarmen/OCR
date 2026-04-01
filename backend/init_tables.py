#!/usr/bin/env python3
"""Initialize database tables manually."""

import asyncio
from app.database import init_db

async def main():
    try:
        await init_db()
        print("[SUCCESS] Database tables created successfully")
    except Exception as e:
        print(f"[ERROR] Failed to create tables: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main())

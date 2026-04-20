import asyncio
import sys
import os

# Add parent dir to path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import engine
from sqlalchemy import text

async def fix():
    print("Connecting to database to fix ocr_tasks schema...")
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE ocr_tasks MODIFY file_path VARCHAR(512) NULL"))
            await conn.execute(text("ALTER TABLE llm_usage_logs ADD COLUMN usage_type VARCHAR(50) NULL AFTER task_id"))
        print("Successfully modified ocr_tasks and llm_usage_logs schema")
    except Exception as e:
        print(f"Error: {str(e).encode('ascii', 'ignore').decode('ascii')}")

if __name__ == "__main__":
    asyncio.run(fix())

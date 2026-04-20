import asyncio
import sys
import os

# Add parent dir to path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import engine
from sqlalchemy import text

async def check():
    print("Checking llm_usage_logs schema...")
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("DESCRIBE llm_usage_logs"))
            rows = result.all()
            for row in rows:
                print(f"Column: {row[0]}, Type: {row[1]}, Nullable: {row[2]}")
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(check())

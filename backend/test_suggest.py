import asyncio
import httpx
import json

async def test_suggest():
    payload = {
        "bank_name": "Bangkok Bank (BBL)",
        "accounts": [
            {"code": "1021005", "name": "ธนาคารกรุงเทพ (BBL)", "type": "B"},
            {"code": "5011001", "name": "ค่าธรรมเนียมธนาคาร", "type": "I"},
            {"code": "1012001", "name": "ภาษีซื้อยังไม่ถึงกำหนด (undue)", "type": "B"}
        ],
        "departments": [
            {"code": "307", "name": "Accounting"},
            {"code": "GEN", "name": "General"}
        ]
    }
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post("http://localhost:8010/api/v1/mapping/suggest", json=payload, timeout=30.0)
            print(f"Status: {resp.status_code}")
            print(f"Body: {resp.text}")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_suggest())

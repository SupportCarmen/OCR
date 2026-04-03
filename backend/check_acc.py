import httpx
import asyncio

async def search_real_accounts():
    auth = "direct f9ebce3d77f2f445dee52ba252cc53ee|e6942437-7db5-4895-96e5-b300161dc2b2"
    url = "https://dev.carmen4.com/Carmen.API/api/interface/accountCode"
    headers = {"Authorization": auth, "User-Agent": "FastAPI-Proxy"}
    
    keywords = {
        "commission": ["commission", "คอมมิชชั่น", "ธรรมเนียม"],
        "tax": ["undue", "รอตัด", "รอเรียกเก็บ", "vat"],
        "net": ["c/a", "s/a", "bank", "ธนาคาร", "กระแสรายวัน", "ออมทรัพย์"]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, headers=headers, timeout=60.0)
            if resp.status_code == 200:
                result = resp.json()
                data = result.get('Data', [])
                print(f"Total Accounts: {len(data)}")
                
                for category, words in keywords.items():
                    print(f"\n--- Matches for {category.upper()} ---")
                    matches = []
                    for a in data:
                        name = (a.get('Description', '') or '').lower()
                        name2 = (a.get('Description2', '') or '').lower()
                        code = str(a.get('AccCode', ''))
                        
                        if any(w.lower() in name or w.lower() in name2 for w in words):
                            matches.append(f"{code} — {a.get('Description')} ({a.get('Description2')})")
                    
                    for m in matches[:15]: # Show top 15 matches
                        print(f"  {m}")
                    if len(matches) > 15:
                        print(f"  ... and {len(matches)-15} more")
            else:
                print(f"API Error: {resp.status_code}")
        except Exception as e:
            print(f"Request failed: {e}")

asyncio.run(search_real_accounts())

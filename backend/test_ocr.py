"""
Quick test script — reads files from uploads/ and calls Vision LLM directly.
Usage (from backend/):
    python test_ocr.py
    python test_ocr.py --file "uploads/Kbank20251231 (3).pdf"
    python test_ocr.py --all
"""
import asyncio
import json
import os
import sys
import argparse

# Make sure app package is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.services.openrouter_ocr import extract_from_image

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
JSON_DIR = os.path.join(os.path.dirname(__file__), "json_test")
os.makedirs(JSON_DIR, exist_ok=True)

def detect_bank(filename: str) -> str:
    name = filename.upper()
    if "BBL" in name or "BBLETAX" in name:
        return "BBL"
    if "KBANK" in name or "KSK" in name or "KASIK" in name:
        return "KBANK"
    if "SCB" in name:
        return "SCB"
    return ""


async def test_file(filepath: str, bank_type: str = None):
    filename = os.path.basename(filepath)
    bank = bank_type or detect_bank(filename)
    print(f"\n{'='*60}")
    print(f"File     : {filename}")
    print(f"Bank     : {bank or 'generic'}")
    print(f"{'='*60}")

    with open(filepath, "rb") as f:
        file_bytes = f.read()

    raw_text, extracted = await extract_from_image(file_bytes, filename, bank or None)

    result = {
        "file": filename,
        "bank_type": bank,
        # Header
        "bank_name":        extracted.bank_name,
        "doc_name":         extracted.doc_name,
        "company_name":     extracted.company_name,
        "company_tax_id":   extracted.company_tax_id,
        "company_address":  extracted.company_address,
        "account_no":       extracted.account_no,
        "doc_date":         extracted.doc_date,
        "doc_no":           extracted.doc_no,
        "merchant_name":    extracted.merchant_name,
        "merchant_id":      extracted.merchant_id,
        "wht_rate":         extracted.wht_rate,
        "wht_amount":       extracted.wht_amount,
        "net_amount":       extracted.net_amount,
        # --- NEW: bank's own info ---
        "bank_companyname": extracted.bank_companyname,
        "back_tax_id":      extracted.back_tax_id,
        "bank_address":     extracted.bank_address,
        # Detail rows
        "details": [d.model_dump() for d in extracted.details],
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))

    # Save to json_test/<filename>.json
    out_name = os.path.splitext(filename)[0] + ".json"
    out_path = os.path.join(JSON_DIR, out_name)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Saved → json_test/{out_name}")

    return result


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", help="Path to a specific file")
    parser.add_argument("--all", action="store_true", help="Test all files in uploads/")
    args = parser.parse_args()

    if args.file:
        await test_file(args.file)
    elif args.all:
        files = [
            os.path.join(UPLOAD_DIR, f)
            for f in os.listdir(UPLOAD_DIR)
            if os.path.isfile(os.path.join(UPLOAD_DIR, f))
        ]
        for fp in sorted(files):
            await test_file(fp)
    else:
        # Default: test one representative file per bank
        one_per_bank = {
            "BBL":   "BBLETAXACQ_002205903289_20260321_26079-0001954_T03.pdf",
            "KBANK": "Kbank20251231 (3).pdf",
            "SCB":   "SCB_credit card commission.pdf",
        }
        for bank_type, fname in one_per_bank.items():
            fp = os.path.join(UPLOAD_DIR, fname)
            if os.path.exists(fp):
                await test_file(fp, bank_type)
            else:
                print(f"⚠️  Not found: {fname}")


if __name__ == "__main__":
    asyncio.run(main())

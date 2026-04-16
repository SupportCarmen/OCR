"""Generic fallback OCR extraction prompt for unrecognized bank documents."""

from app.llm.prompts._shared import ROW_RULES, OUTPUT_RULES

PROMPT = """You are a document data extractor specialized in Thai bank receipts and tax invoices (ใบเสร็จรับเงิน/ใบกำกับภาษี).

Carefully read all text in the image. Identify the data table and extract structured data.
""" + ROW_RULES + OUTPUT_RULES

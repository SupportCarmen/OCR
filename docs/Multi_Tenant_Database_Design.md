# Multi-Tenant Database Design

ระบบใช้รูปแบบ **Separate Schema per Tenant** — แต่ละ tenant ได้ database ของตัวเองใน MariaDB instance เดียวกัน

---

## แนวคิดหลัก

```
carmen_ai_abc/          ← ข้อมูลของ tenant "abc" ทั้งหมด
  credit_cards
  ocr_tasks
  audit_logs
  ...

carmen_ai_xyz/          ← ข้อมูลของ tenant "xyz" ทั้งหมด
  credit_cards
  ocr_tasks
  audit_logs
  ...
```

ไม่มี `tenant` column ในตารางใดเลย — isolation อยู่ที่ระดับ database

---

## Tenant คืออะไร

Tenant คือ subdomain ที่ผู้ใช้เข้ามา:

| URL ที่เข้ามา | Tenant | Database |
|---|---|---|
| `https://abc.carmen4.com` | `abc` | `carmen_ai_abc` |
| `https://xyz.carmen4.com` | `xyz` | `carmen_ai_xyz` |
| `http://localhost:3010` | `dev` (fallback) | `carmen_ai_dev` |

---

## Tenant Flow ตั้งแต่ Request ถึง Query

```
1. Request เข้า (Origin: https://abc.carmen4.com)
        ↓
2. PerformanceMiddleware
   _tenant_from_request() → "abc"
   current_tenant.set("abc")           ← context var
        ↓
3. get_current_session() / get_db()
   อ่าน current_tenant.get() → "abc"
   _get_engine("abc") → engine สำหรับ carmen_ai_abc
        ↓
4. Query ทำงานใน carmen_ai_abc โดยอัตโนมัติ
   ไม่ต้อง WHERE tenant = ?
```

---

## Engine Registry

```python
# database.py
_ENGINES: dict[str, AsyncEngine] = {}

def _get_engine(tenant: str) -> AsyncEngine:
    if tenant not in _ENGINES:
        _ENGINES[tenant] = create_async_engine(
            f"{db_root}/carmen_ai_{tenant}",
            pool_size=5, max_overflow=10,
        )
    return _ENGINES[tenant]
```

Engine สร้างครั้งแรกแล้ว cache ตลอด lifetime ของ process — connection pool ถูกนำกลับมาใช้ทุก request

---

## Context-Aware Session Shim

```python
def async_session() -> AsyncSession:
    """Services ทุกตัวใช้ async_session() โดยไม่ต้องส่ง tenant เข้าไป"""
    from app.context import current_tenant
    tenant = current_tenant.get("") or settings.carmen_tenant_default
    return _get_session_factory(tenant)()
```

Service ทุกตัวใช้ `async with async_session() as db:` เหมือนเดิม — routing เกิดขึ้นอัตโนมัติจาก context var

---

## โครงสร้าง Tables (ต่อ 1 tenant DB)

| Table | คำอธิบาย | Retention |
|---|---|---|
| `ocr_tasks` | metadata ของ file upload | — |
| `credit_cards` | document header ของ credit card statement | — |
| `ap_invoices` | audit trail ของ AP invoice | — |
| `ocr_sessions` | Carmen SSO sessions | inactive > 30 วัน |
| `mapping_history` | ประวัติ GL account mapping ที่ confirm แล้ว | — |
| `correction_feedback` | การแก้ไข OCR ของ user | — |
| `llm_usage_logs` | token usage + cost ต่อ LLM call | 365 วัน → CSV |
| `audit_logs` | trail การกระทำของ user | 365 วัน → CSV |
| `performance_logs` | API request latency (partitioned) | 90 วัน → CSV |
| `outbound_call_logs` | HTTP calls ไป Carmen / OpenRouter (partitioned) | 90 วัน → CSV |
| `daily_usage_summary` | metrics รายวัน pre-aggregated | — |
| `model_pricing` | ราคา LLM model จาก OpenRouter | — |
| `schema_migrations` | tracking migration ที่รันแล้ว | — |

---

## Provisioning Tenant ใหม่

```python
# สร้าง tenant ใหม่ (เรียกครั้งเดียว)
from app.database import provision_tenant
await provision_tenant("abc")

# หรือจาก command line:
python -c "import asyncio; from app.database import provision_tenant; asyncio.run(provision_tenant('abc'))"
```

`provision_tenant()` ทำ:
1. `CREATE DATABASE IF NOT EXISTS carmen_ai_abc`
2. `Base.metadata.create_all()` — สร้างทุก table ในสถานะสุดท้าย
3. Pre-mark migrations ทั้งหมดว่า applied แล้ว (ไม่ต้องรัน migration เก่า)

---

## Migration System

```python
# database.py
_MIGRATIONS = [
    ("001_receipt_columns",   None),   # legacy — None = stub ไม่มี logic
    ...
    ("020_fix_correction_...", None),  # legacy
    ("021_remove_tenant_columns", _m021_remove_tenant_columns),  # live migration
]
```

**กฎ:**
- เพิ่ม migration ท้ายสุดเสมอ ห้าม reorder
- Legacy migrations (001-020) มี `fn=None` — runner mark applied โดยไม่รัน code
- DB ใหม่ที่ provision ผ่าน `provision_tenant()`: pre-mark ทั้งหมด ไม่รัน migration ใดเลย
- DB เก่าที่ migrate มาจาก shared schema: รัน m021 เพื่อลบ tenant column

---

## Data Retention

ทำงานทุกคืนผ่าน scheduler → `_run_for_all_tenants()` → วนลูปทุก tenant

```python
async def _run_for_all_tenants(coro_factory, label):
    tenants = await get_all_tenants()
    for tenant in tenants:
        token = current_tenant.set(tenant)   # set context → async_session() ใช้ DB ถูกตัว
        try:
            await coro_factory()
        finally:
            current_tenant.reset(token)
```

| Table | เก็บไว้ | Archive |
|---|---|---|
| `performance_logs` | 90 วัน | CSV → `archives/performance_logs/YYYY-MM.csv` |
| `outbound_call_logs` | 90 วัน | CSV → `archives/outbound_call_logs/YYYY-MM.csv` |
| `llm_usage_logs` | 365 วัน | CSV → `archives/llm_usage_logs/YYYY-MM.csv` |
| `audit_logs` | 365 วัน | CSV → `archives/audit_logs/YYYY-MM.csv` |
| `ocr_sessions` (inactive) | 30 วัน | ลบทิ้ง (ไม่ archive) |

---

## Migration จาก Schema เดิม (ocr_db)

สำหรับ server ที่มีข้อมูลอยู่แล้ว ให้รัน script ก่อน deploy code ใหม่:

```bash
cd backend
venv\Scripts\activate

# ดูก่อนว่าจะย้ายอะไรบ้าง (ไม่เขียน DB)
python scripts/migrate_to_separate_schema.py --dry-run

# ย้ายจริง
python scripts/migrate_to_separate_schema.py
```

Script จะ:
1. อ่าน tenant ที่มีจาก `ocr_db.ocr_tasks`
2. สร้าง `carmen_ai_{tenant}` ต่อ tenant
3. Copy ข้อมูลแยก tenant
4. Copy `model_pricing` เข้าทุก tenant DB

หลังจาก verify row counts แล้ว ค่อย deploy code ใหม่ และ drop `ocr_db` เมื่อพร้อม

---

## Connection Pool

```python
create_async_engine(
    f".../{db_name}",
    pool_pre_ping=True,   # ตรวจ connection ก่อนใช้
    pool_size=5,          # ต่อ tenant (ลดจาก 10 เพราะมีหลาย pool)
    max_overflow=10,      # รวม 15 ต่อ tenant
)
```

ถ้ามี 10 tenants: max 150 connections รวม — ปรับ `pool_size` ใน `database.py` ตาม workload จริง

---

## เพิ่ม Table ใหม่

1. เพิ่ม ORM model ใน `models/orm.py` — **ไม่ต้องมี `tenant` column**
2. เพิ่ม migration function ใน `database.py` และ register ใน `_MIGRATIONS`
3. ถ้าเป็น log table ให้เพิ่มเข้า `RETENTION_POLICY` ใน `retention_service.py`
4. `provision_tenant()` จะสร้าง table ให้ tenant ใหม่อัตโนมัติ
5. `migrate_all_tenants()` จะ apply migration ให้ tenant เดิมอัตโนมัติตอน startup

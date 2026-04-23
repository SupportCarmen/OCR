"""
Carmen Proxy Router — thin HTTP layer for Carmen ERP API calls.

All business logic and HTTP construction lives in `services/carmen_service.py`.
These endpoints simply check configuration, call the service, and map errors to HTTP responses.

Paths are kept identical to the original /api/v1/ocr/carmen/* so the frontend requires no changes.
"""

import logging

from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.services.carmen_service import (
    CarmenAPIError,
    get_account_codes,
    get_departments,
    get_gl_prefix,
    get_period_list,
    get_tax_profiles,
    get_vendors,
    post_gljv,
    post_input_tax,
    post_invoice,
    put_gljv,
    put_input_tax,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ocr/carmen", tags=["Carmen"])


def _require_auth():
    if not settings.carmen_authorization:
        raise HTTPException(status_code=500, detail="carmen_authorization not configured")


@router.get("/account-codes")
async def proxy_account_codes():
    _require_auth()
    try:
        return await get_account_codes()
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/departments")
async def proxy_departments():
    _require_auth()
    try:
        return await get_departments()
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/gl-prefix")
async def proxy_gl_prefix():
    # gl-prefix is soft — returns empty list when not configured (no 500)
    try:
        return await get_gl_prefix()
    except CarmenAPIError as e:
        return {"Data": [], "Status": f"upstream_{e.status_code}"}


@router.post("/gljv")
async def proxy_gljv(request: Request):
    _require_auth()
    body = await request.json()
    try:
        return await post_gljv(body)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Carmen GL JV ล้มเหลว: {e.detail}")


@router.put("/gljv/{jvh_seq}")
async def proxy_update_gljv(jvh_seq: int, request: Request):
    _require_auth()
    body = await request.json()
    try:
        return await put_gljv(jvh_seq, body)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Carmen GL JV update ล้มเหลว: {e.detail}")


@router.get("/vendors")
async def proxy_vendors():
    _require_auth()
    try:
        return await get_vendors()
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/tax-profiles")
async def proxy_tax_profiles():
    _require_auth()
    try:
        return await get_tax_profiles()
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.get("/period-list")
async def proxy_period_list():
    _require_auth()
    try:
        return await get_period_list()
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)


@router.post("/input-tax")
async def proxy_create_input_tax(request: Request):
    _require_auth()
    body = await request.json()
    try:
        return await post_input_tax(body)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Carmen Input Tax ล้มเหลว: {e.detail}")


@router.put("/input-tax/{rec_seq}")
async def proxy_update_input_tax(rec_seq: int, request: Request):
    _require_auth()
    body = await request.json()
    try:
        return await put_input_tax(rec_seq, body)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Carmen Input Tax update ล้มเหลว: {e.detail}")


@router.post("/invoice")
async def proxy_create_invoice(request: Request):
    _require_auth()
    body = await request.json()
    try:
        return await post_invoice(body)
    except CarmenAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=f"Carmen Invoice ล้มเหลว: {e.detail}")

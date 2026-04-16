"""
Carmen Proxy Router — thin HTTP layer for Carmen ERP API calls.

All business logic and HTTP construction lives in `services/carmen_service.py`.
These endpoints simply check configuration, call the service, and map errors to HTTP responses.

Paths are kept identical to the original /api/v1/ocr/carmen/* so the frontend requires no changes.
"""

import logging

from fastapi import APIRouter, HTTPException, Request

from app.config import settings
from app.services.carmen_service import CarmenAPIError, get_account_codes, get_departments, get_gl_prefix, post_gljv

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

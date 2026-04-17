"""
Carmen API Service — all HTTP calls to the Carmen ERP API.

Centralizes base URL, auth headers, and error handling for Carmen requests.
The router (`routers/carmen.py`) calls these functions; it does not build HTTP requests itself.
"""

import logging
from typing import Any, Dict

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_BASE_URL = "https://dev.carmen4.com/Carmen.API/api/interface"
_TIMEOUT  = 30.0


def _headers() -> Dict[str, str]:
    return {
        "Authorization": settings.carmen_authorization,
        "User-Agent": "FastAPI-Proxy",
    }


class CarmenAPIError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


async def get_account_codes() -> Any:
    """Fetch account codes from Carmen API."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE_URL}/accountCode", headers=_headers())
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()


async def get_departments() -> Any:
    """Fetch departments from Carmen API."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE_URL}/department", headers=_headers())
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()


async def get_gl_prefix() -> Any:
    """Fetch GL prefixes from Carmen API. Returns empty list if unconfigured."""
    if not settings.carmen_authorization:
        return {"Data": [], "Status": "not_configured"}

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE_URL}/glPrefix", headers=_headers())
        if resp.status_code != 200:
            return {"Data": [], "Status": f"upstream_{resp.status_code}"}
        return resp.json()


async def post_gljv(body: dict) -> Any:
    """Submit a GL Journal Voucher to Carmen API."""
    hdrs = {**_headers(), "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(f"{_BASE_URL}/gljv", json=body, headers=hdrs)
        try:
            return resp.json()
        except Exception:
            raise CarmenAPIError(resp.status_code, resp.text)


async def put_gljv(jvh_seq: int, body: dict) -> Any:
    """Update an existing GL Journal Voucher in Carmen API."""
    hdrs = {**_headers(), "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.put(f"{_BASE_URL}/gljv/{jvh_seq}", json=body, headers=hdrs)
        try:
            return resp.json()
        except Exception:
            raise CarmenAPIError(resp.status_code, resp.text)


async def get_vendors() -> Any:
    """Fetch vendor list from Carmen API."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE_URL}/vendor", headers=_headers())
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()


async def get_tax_profiles() -> Any:
    """Fetch tax profile list from Carmen API."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE_URL}/taxProfile", headers=_headers())
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()


async def get_period_list() -> Any:
    """Fetch AP period list from Carmen API."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE_URL}/getPeriodList", headers=_headers())
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()


async def post_input_tax(body: dict) -> Any:
    """Create an Input Tax record in Carmen API."""
    hdrs = {**_headers(), "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(f"{_BASE_URL}/inputTaxRec", json=body, headers=hdrs)
        try:
            return resp.json()
        except Exception:
            raise CarmenAPIError(resp.status_code, resp.text)


async def put_input_tax(rec_seq: int, body: dict) -> Any:
    """Update an existing Input Tax record in Carmen API."""
    hdrs = {**_headers(), "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.put(f"{_BASE_URL}/inputTaxRec/{rec_seq}", json=body, headers=hdrs)
        try:
            return resp.json()
        except Exception:
            raise CarmenAPIError(resp.status_code, resp.text)

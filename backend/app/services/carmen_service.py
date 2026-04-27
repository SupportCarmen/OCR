"""
Carmen API Service — all HTTP calls to the Carmen ERP API.

Every public function accepts `carmen_token: str` so the caller's session token
is used per-request instead of a shared env-var credential.

Outbound calls are logged via httpx event hooks to prove data only reaches Carmen.
"""

import logging
import time
from typing import Any, Dict

import httpx

logger = logging.getLogger(__name__)

_BASE_URL = "https://dev.carmen4.com/Carmen.API/api/interface"
_TIMEOUT  = 30.0


def _headers(carmen_token: str) -> Dict[str, str]:
    return {
        "Authorization": carmen_token,
        "User-Agent": "FastAPI-Proxy",
    }


class CarmenAPIError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


# ── httpx event hooks for outbound logging ────────────────────────────────────

async def _on_request(request: httpx.Request) -> None:
    """Record request start time on the request's extensions dict."""
    request.extensions["_start"] = time.perf_counter()


async def _on_response(response: httpx.Response) -> None:
    """Fire-and-forget log entry after Carmen responds."""
    from app.services.outbound_log_service import log_outbound
    start = response.request.extensions.get("_start", time.perf_counter())
    duration_ms = (time.perf_counter() - start) * 1000
    await log_outbound(
        service="carmen",
        url=str(response.request.url),
        method=response.request.method,
        status_code=response.status_code,
        duration_ms=duration_ms,
        request_size_bytes=int(response.request.headers.get("content-length", 0) or 0),
    )


def _client(carmen_token: str) -> httpx.AsyncClient:
    """Return an AsyncClient with auth headers + outbound logging hooks."""
    return httpx.AsyncClient(
        timeout=_TIMEOUT,
        headers=_headers(carmen_token),
        event_hooks={"request": [_on_request], "response": [_on_response]},
    )


# ── Service functions ─────────────────────────────────────────────────────────

async def get_account_codes(carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.get(f"{_BASE_URL}/accountCode")
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()


async def get_departments(carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.get(f"{_BASE_URL}/department")
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()


async def get_gl_prefix(carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.get(f"{_BASE_URL}/glPrefix")
        if resp.status_code != 200:
            return {"Data": [], "Status": f"upstream_{resp.status_code}"}
        return resp.json()


async def post_gljv(body: dict, carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.post(f"{_BASE_URL}/gljv", json=body)
        try:
            return resp.json()
        except Exception:
            raise CarmenAPIError(resp.status_code, resp.text)


async def put_gljv(jvh_seq: int, body: dict, carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.put(f"{_BASE_URL}/gljv/{jvh_seq}", json=body)
        try:
            return resp.json()
        except Exception:
            raise CarmenAPIError(resp.status_code, resp.text)


_VENDOR_FIELDS = frozenset({
    'VnCode', 'VnName', 'Active', 'VnTaxNo', 'VnCateCode', 'VnCateDesc',
    'VnVat1DrAccCode', 'VnVat1DrAccDesc', 'VnVat1DrDeptCode', 'VnVat1DrDeptDesc',
    'VnVatCrAccCode', 'VnVatCrAccDesc', 'VnCrDeptCode', 'VnCrDeptDesc',
    'TaxProfileCode1', 'TaxProfileDesc1', 'BranchNo', 'VnTerm',
})


async def get_vendors(carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.get(f"{_BASE_URL}/vendor")
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        data = resp.json()
        if isinstance(data, dict) and isinstance(data.get('Data'), list):
            data['Data'] = [
                {k: v for k, v in item.items() if k in _VENDOR_FIELDS}
                for item in data['Data']
            ]
        return data


async def get_tax_profiles(carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.get(f"{_BASE_URL}/taxProfile")
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()


async def get_period_list(carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.get(f"{_BASE_URL}/getPeriodList")
        if resp.status_code != 200:
            raise CarmenAPIError(resp.status_code, resp.text)
        return resp.json()


async def post_input_tax(body: dict, carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.post(f"{_BASE_URL}/inputTaxRec", json=body)
        try:
            return resp.json()
        except Exception:
            raise CarmenAPIError(resp.status_code, resp.text)


async def put_input_tax(rec_seq: int, body: dict, carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.put(f"{_BASE_URL}/inputTaxRec/{rec_seq}", json=body)
        try:
            return resp.json()
        except Exception:
            raise CarmenAPIError(resp.status_code, resp.text)


async def post_invoice(body: dict, carmen_token: str) -> Any:
    async with _client(carmen_token) as client:
        resp = await client.post(f"{_BASE_URL}/invoice", json=body)
        try:
            return resp.json()
        except Exception:
            raise CarmenAPIError(resp.status_code, resp.text)

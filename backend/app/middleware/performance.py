"""
Performance Middleware — measures wall-clock time for every API request.

Extracts user_id directly from the JWT Authorization header (no DB lookup)
so it works correctly even though BaseHTTPMiddleware runs in a separate asyncio
context from FastAPI dependencies.
"""

import logging
import time

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.database import async_session
from app.models.orm import PerformanceLog

logger = logging.getLogger(__name__)

_SKIP_PATHS = {"/", "/docs", "/openapi.json", "/redoc", "/api/v1/ocr/health", "/api/version"}


def _user_id_from_request(request: Request) -> str | None:
    """Decode user_id from JWT without DB lookup — lightweight, never raises."""
    try:
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer "):
            return None
        from app.config import settings
        payload = jwt.decode(auth[7:], settings.ocr_jwt_secret, algorithms=["HS256"])
        return payload.get("user_id")
    except (JWTError, Exception):
        return None


class PerformanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _SKIP_PATHS:
            return await call_next(request)

        # Read user_id BEFORE call_next — same task context, JWT available now
        user_id = _user_id_from_request(request)

        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000

        import asyncio
        asyncio.ensure_future(_persist(
            endpoint=request.url.path,
            method=request.method,
            duration_ms=duration_ms,
            status_code=response.status_code,
            user_id=user_id,
            document_ref=request.path_params.get("task_id") or request.path_params.get("receipt_id"),
        ))

        response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
        return response


async def _persist(
    endpoint: str,
    method: str,
    duration_ms: float,
    status_code: int,
    user_id: str | None,
    document_ref: str | None,
) -> None:
    try:
        async with async_session() as db:
            db.add(PerformanceLog(
                endpoint=endpoint,
                method=method,
                duration_ms=duration_ms,
                status_code=status_code,
                user_id=user_id,
                document_ref=document_ref,
            ))
            await db.commit()
    except Exception as exc:
        logger.error("PerformanceMiddleware._persist failed: %s", exc)

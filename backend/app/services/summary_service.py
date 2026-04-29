"""
Summary Service — build daily usage aggregates per tenant.

Runs nightly via the scheduler in main.py.
Aggregates raw data from log tables into daily_usage_summary for fast dashboard queries.
Uses UPSERT so re-running for the same date is safe (idempotent).
"""

import logging
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import text
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.database import async_session
from app.models.orm import DailyUsageSummary

logger = logging.getLogger(__name__)


async def build_daily_summary(target_date: Optional[date] = None) -> dict:
    """
    Aggregate yesterday's data (or a specific date) into daily_usage_summary.

    For each tenant that had activity on target_date:
      - total_documents, total_submissions
      - LLM: calls, tokens, cost, avg latency
      - API: calls, avg/p95 latency, errors
      - corrections count, outbound calls count

    Returns: {tenant: {metrics...}} or error.
    """
    if target_date is None:
        target_date = (datetime.utcnow() - timedelta(days=1)).date()

    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)

    logger.info("[summary] Building daily summary for %s", target_date)

    results = {}
    try:
        async with async_session() as db:
            # 1. Get all active tenants for this day (union from key tables)
            tenant_result = await db.execute(text("""
                SELECT DISTINCT tenant FROM (
                    SELECT tenant FROM ocr_tasks
                        WHERE created_at >= :start AND created_at < :end AND tenant IS NOT NULL
                    UNION
                    SELECT tenant FROM credit_cards
                        WHERE created_at >= :start AND created_at < :end AND tenant IS NOT NULL
                    UNION
                    SELECT tenant FROM audit_logs
                        WHERE created_at >= :start AND created_at < :end AND tenant IS NOT NULL
                ) AS active_tenants
            """), {"start": day_start, "end": day_end})
            tenants = [row[0] for row in tenant_result.fetchall()]

            if not tenants:
                logger.info("[summary] No active tenants for %s — skipping", target_date)
                return {}

            for tenant in tenants:
                params = {"tenant": tenant, "start": day_start, "end": day_end}
                metrics = await _aggregate_tenant(db, params)
                metrics["tenant"] = tenant
                metrics["summary_date"] = target_date

                # UPSERT into daily_usage_summary
                stmt = (
                    mysql_insert(DailyUsageSummary)
                    .values(**metrics)
                    .on_duplicate_key_update(**{
                        k: v for k, v in metrics.items()
                        if k not in ("tenant", "summary_date")
                    })
                )
                await db.execute(stmt)
                results[tenant] = metrics

            await db.commit()
            logger.info("[summary] Built summaries for %d tenants on %s", len(tenants), target_date)

    except Exception as exc:
        logger.error("[summary] Failed for %s: %s", target_date, exc)
        raise

    return results


async def _aggregate_tenant(db, params: dict) -> dict:
    """Run aggregation queries for one tenant on one day."""

    # ── Documents & Submissions ──
    doc_result = await db.execute(text("""
        SELECT COUNT(*) FROM ocr_tasks
        WHERE tenant = :tenant AND created_at >= :start AND created_at < :end
    """), params)
    total_documents = doc_result.scalar() or 0

    sub_result = await db.execute(text("""
        SELECT COUNT(*) FROM credit_cards
        WHERE tenant = :tenant AND submitted_at >= :start AND submitted_at < :end
    """), params)
    total_submissions = sub_result.scalar() or 0

    # ── LLM Usage ──
    llm_result = await db.execute(text("""
        SELECT
            COUNT(*)                    AS total_llm_calls,
            COALESCE(SUM(total_tokens), 0) AS total_tokens,
            COALESCE(SUM(cost_usd), 0) AS total_cost_usd,
            COALESCE(AVG(duration_ms), 0) AS avg_llm_latency_ms
        FROM llm_usage_logs
        WHERE tenant = :tenant AND created_at >= :start AND created_at < :end
    """), params)
    llm = llm_result.mappings().fetchone()

    # ── API Performance ──
    perf_result = await db.execute(text("""
        SELECT
            COUNT(*)                          AS total_api_calls,
            COALESCE(AVG(duration_ms), 0)     AS avg_api_latency_ms,
            COALESCE(SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END), 0) AS total_errors
        FROM performance_logs
        WHERE tenant = :tenant AND created_at >= :start AND created_at < :end
    """), params)
    perf = perf_result.mappings().fetchone()

    # P95 latency (approximate via PERCENT_RANK)
    p95_result = await db.execute(text("""
        SELECT duration_ms FROM performance_logs
        WHERE tenant = :tenant AND created_at >= :start AND created_at < :end
        ORDER BY duration_ms ASC
        LIMIT 1
        OFFSET GREATEST(0,
            CAST(
                (SELECT COUNT(*) FROM performance_logs
                 WHERE tenant = :tenant AND created_at >= :start AND created_at < :end
                ) * 0.95 AS UNSIGNED
            ) - 1
        )
    """), params)
    p95_row = p95_result.fetchone()
    p95_api_latency_ms = p95_row[0] if p95_row else 0

    # ── Corrections ──
    corr_result = await db.execute(text("""
        SELECT COUNT(*) FROM correction_feedback
        WHERE tenant = :tenant AND created_at >= :start AND created_at < :end
    """), params)
    total_corrections = corr_result.scalar() or 0

    # ── Outbound Calls ──
    out_result = await db.execute(text("""
        SELECT COUNT(*) FROM outbound_call_logs
        WHERE tenant = :tenant AND created_at >= :start AND created_at < :end
    """), params)
    total_outbound_calls = out_result.scalar() or 0

    return {
        "total_documents": total_documents,
        "total_submissions": total_submissions,
        "total_llm_calls": llm["total_llm_calls"],
        "total_tokens": llm["total_tokens"],
        "total_cost_usd": llm["total_cost_usd"],
        "avg_llm_latency_ms": round(float(llm["avg_llm_latency_ms"]), 2),
        "total_api_calls": perf["total_api_calls"],
        "avg_api_latency_ms": round(float(perf["avg_api_latency_ms"]), 2),
        "p95_api_latency_ms": round(float(p95_api_latency_ms), 2),
        "total_errors": perf["total_errors"],
        "total_corrections": total_corrections,
        "total_outbound_calls": total_outbound_calls,
    }


async def backfill_summaries(from_date: date, to_date: date) -> int:
    """Rebuild summaries for a date range (inclusive). Returns count of days processed."""
    count = 0
    current = from_date
    while current <= to_date:
        await build_daily_summary(current)
        current += timedelta(days=1)
        count += 1
    return count

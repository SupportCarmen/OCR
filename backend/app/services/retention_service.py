"""
Retention Service — archive old log rows to CSV, then delete from DB.

Runs nightly via the scheduler in main.py.
Each table has a retention period; rows older than that are:
  1. Exported to CSV in {archive_dir}/{table}/YYYY-MM.csv
  2. Deleted in small batches to avoid long table locks.

CSV files can be imported back into the DB or analyzed offline.
"""

import csv
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Tuple

from sqlalchemy import text

from app.config import settings
from app.database import async_session

logger = logging.getLogger(__name__)

# ── Retention Policy ─────────────────────────────────────────────────────────
# (table_name, retention_days, columns_to_archive)
RETENTION_POLICY: List[Tuple[str, int, List[str]]] = [
    (
        "performance_logs", 90,
        ["id", "endpoint", "method", "duration_ms",
         "status_code", "user_id", "document_ref", "created_at"],
    ),
    (
        "outbound_call_logs", 90,
        ["id", "service", "url", "method", "status_code",
         "duration_ms", "request_size_bytes", "session_id", "user_id", "created_at"],
    ),
    (
        "llm_usage_logs", 365,
        ["id", "task_id", "usage_type", "model", "prompt_tokens",
         "completion_tokens", "total_tokens", "duration_ms", "cost_usd",
         "session_id", "user_id", "bu_name", "created_at"],
    ),
    (
        "audit_logs", 365,
        ["id", "session_id", "user_id", "username", "bu",
         "action", "resource", "document_ref", "ip_address", "created_at"],
    ),
]

# ocr_sessions cleanup is separate — inactive sessions (is_active=0) are purged
# after SESSION_INACTIVE_PURGE_DAYS regardless of creation date.
SESSION_INACTIVE_PURGE_DAYS = 30

# Max rows to delete per batch — keeps lock time short
_BATCH_SIZE = 5000


async def archive_and_cleanup() -> dict:
    """
    For each table in RETENTION_POLICY:
      1. SELECT rows older than retention period
      2. Write them to CSV (append-mode, grouped by month)
      3. DELETE in batches by id range

    Returns a summary dict: {table: {"archived": N, "deleted": N}}
    """
    if not settings.retention_enabled:
        logger.info("[retention] Disabled via RETENTION_ENABLED=false — skipping")
        return {}

    summary = {}
    archive_base = Path(settings.archive_dir)

    for table, retention_days, columns in RETENTION_POLICY:
        cutoff = datetime.utcnow() - timedelta(days=retention_days)
        try:
            result = await _process_table(table, cutoff, columns, archive_base)
            summary[table] = result
            if result["archived"] > 0:
                logger.info(
                    "[retention] %s: archived=%d, deleted=%d (cutoff=%s)",
                    table, result["archived"], result["deleted"], cutoff.date(),
                )
        except Exception as exc:
            logger.error("[retention] %s FAILED: %s", table, exc)
            summary[table] = {"archived": 0, "deleted": 0, "error": str(exc)}

    return summary


async def _process_table(
    table: str,
    cutoff: datetime,
    columns: List[str],
    archive_base: Path,
) -> dict:
    """Archive + delete old rows for one table."""

    col_list = ", ".join(columns)
    archived = 0
    deleted = 0

    async with async_session() as db:
        # 1. Count how many rows will be affected
        count_result = await db.execute(
            text(f"SELECT COUNT(*) FROM {table} WHERE created_at < :cutoff"),
            {"cutoff": cutoff},
        )
        total = count_result.scalar() or 0

        if total == 0:
            return {"archived": 0, "deleted": 0}

        logger.info("[retention] %s: %d rows older than %s", table, total, cutoff.date())

        # 2. Stream rows and write to CSV (grouped by YYYY-MM of created_at)
        result = await db.execute(
            text(f"SELECT {col_list} FROM {table} WHERE created_at < :cutoff ORDER BY id"),
            {"cutoff": cutoff},
        )
        rows = result.fetchall()

        if not rows:
            return {"archived": 0, "deleted": 0}

        # Group rows by month for separate CSV files
        month_groups: dict[str, list] = {}
        for row in rows:
            row_dict = dict(zip(columns, row))
            created = row_dict.get("created_at")
            if isinstance(created, datetime):
                month_key = created.strftime("%Y-%m")
            else:
                month_key = "unknown"
            month_groups.setdefault(month_key, []).append(row_dict)

        # Write CSV files
        table_dir = archive_base / table
        table_dir.mkdir(parents=True, exist_ok=True)

        for month_key, month_rows in month_groups.items():
            csv_path = table_dir / f"{month_key}.csv"
            file_exists = csv_path.exists()

            with open(csv_path, "a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=columns)
                if not file_exists:
                    writer.writeheader()
                for row_dict in month_rows:
                    # Convert datetime to ISO string for CSV
                    for k, v in row_dict.items():
                        if isinstance(v, datetime):
                            row_dict[k] = v.isoformat()
                    writer.writerow(row_dict)

            archived += len(month_rows)
            logger.debug("[retention] %s/%s.csv: +%d rows", table, month_key, len(month_rows))

        # 3. Delete in batches by id range
        min_id = rows[0][0]  # first column is id
        max_id = rows[-1][0]

        while True:
            del_result = await db.execute(
                text(
                    f"DELETE FROM {table} "
                    f"WHERE id >= :min_id AND id <= :max_id AND created_at < :cutoff "
                    f"LIMIT :batch_size"
                ),
                {"min_id": min_id, "max_id": max_id, "cutoff": cutoff, "batch_size": _BATCH_SIZE},
            )
            await db.commit()
            batch_deleted = del_result.rowcount
            deleted += batch_deleted
            if batch_deleted < _BATCH_SIZE:
                break  # no more rows to delete

    return {"archived": archived, "deleted": deleted}


async def purge_inactive_sessions() -> int:
    """
    Delete ocr_sessions rows that have been inactive (is_active=0)
    for more than SESSION_INACTIVE_PURGE_DAYS days.

    Active sessions are never deleted here — JWT exp + Carmen 401
    deactivation handle live session invalidation.
    Returns the number of rows deleted.
    """
    cutoff = datetime.utcnow() - timedelta(days=SESSION_INACTIVE_PURGE_DAYS)
    deleted = 0

    async with async_session() as db:
        while True:
            result = await db.execute(
                text(
                    "DELETE FROM ocr_sessions "
                    "WHERE is_active = 0 AND last_used_at < :cutoff "
                    "LIMIT :batch_size"
                ),
                {"cutoff": cutoff, "batch_size": _BATCH_SIZE},
            )
            await db.commit()
            batch_deleted = result.rowcount
            deleted += batch_deleted
            if batch_deleted < _BATCH_SIZE:
                break

    if deleted:
        logger.info("[retention] ocr_sessions: purged %d inactive sessions (cutoff=%s)", deleted, cutoff.date())
    return deleted

"""
Partition Manager — auto-create quarterly partitions for hot log tables.

Runs monthly via the scheduler in main.py.
Ensures partitions exist for the current quarter and the next one,
so inserts never fail due to missing partitions.

Only applicable to tables partitioned via m016.
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import text

from app.database import engine

logger = logging.getLogger(__name__)

# Tables that are range-partitioned by TO_DAYS(created_at)
_PARTITIONED_TABLES = ["performance_logs", "outbound_call_logs"]


def _quarter_boundaries(dt: datetime) -> list[tuple[str, str]]:
    """
    Return partition boundaries for the quarter containing `dt`
    and the next 2 quarters.

    Returns: [(partition_name, boundary_date_str), ...]
    """
    year = dt.year
    quarter = (dt.month - 1) // 3 + 1

    partitions = []
    for i in range(3):  # current + next 2
        q = quarter + i
        y = year
        while q > 4:
            q -= 4
            y += 1
        # Boundary = first day of NEXT quarter
        next_q = q + 1
        next_y = y
        if next_q > 4:
            next_q = 1
            next_y += 1
        boundary = f"{next_y}-{next_q * 3 - 2:02d}-01"
        name = f"p{y}q{q}"
        partitions.append((name, boundary))

    return partitions


async def ensure_partitions() -> dict:
    """
    Check each partitioned table and create missing quarterly partitions.

    Strategy:
      1. Query INFORMATION_SCHEMA.PARTITIONS for existing partition names
      2. Compare with needed partitions (current + next 2 quarters)
      3. If p_future exists, REORGANIZE it to add new partitions

    Returns: {table: [created_partition_names]}
    """
    now = datetime.utcnow()
    needed = _quarter_boundaries(now)
    results = {}

    async with engine.begin() as conn:
        for table in _PARTITIONED_TABLES:
            created = []
            try:
                # Check if table is partitioned
                part_result = await conn.execute(text("""
                    SELECT PARTITION_NAME
                    FROM INFORMATION_SCHEMA.PARTITIONS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME = :table
                      AND PARTITION_NAME IS NOT NULL
                """), {"table": table})
                existing = {row[0] for row in part_result.fetchall()}

                if not existing:
                    logger.debug("[partition] %s is not partitioned — skipping", table)
                    results[table] = []
                    continue

                for part_name, boundary in needed:
                    if part_name in existing:
                        continue

                    if "p_future" not in existing:
                        logger.warning(
                            "[partition] %s: p_future partition missing — cannot reorganize",
                            table,
                        )
                        break

                    # REORGANIZE p_future to carve out the new partition
                    await conn.execute(text(f"""
                        ALTER TABLE {table}
                        REORGANIZE PARTITION p_future INTO (
                            PARTITION {part_name} VALUES LESS THAN (TO_DAYS('{boundary}')),
                            PARTITION p_future VALUES LESS THAN MAXVALUE
                        )
                    """))
                    created.append(part_name)
                    existing.add(part_name)
                    logger.info("[partition] %s: created partition %s (boundary=%s)",
                                table, part_name, boundary)

            except Exception as exc:
                logger.error("[partition] %s: failed — %s", table, exc)

            results[table] = created

    return results

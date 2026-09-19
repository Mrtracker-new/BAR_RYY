"""
High-stress atomic view-count concurrency test suite.
"""

import asyncio
import uuid
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from core.database import Database


@pytest_asyncio.fixture
async def temp_db(tmp_path, monkeypatch):
    """Initialize a clean SQLite database instance with WAL pooling enabled."""
    db_file = tmp_path / "test_views.db"
    db_url = f"sqlite:///{db_file}"
    monkeypatch.setattr("core.database.DATABASE_URL", db_url)
    db = Database()
    await db.init_db()
    yield db
    if db._sqlite_pool:
        await db._sqlite_pool.close()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "num_tasks,max_views",
    [
        (5, 1),
        (10, 5),
        (50, 50),
        (100, 5),
    ],
    ids=["5_tasks_max_1", "10_tasks_max_5", "50_tasks_max_50", "100_tasks_max_5"],
)
async def test_atomic_view_count_concurrency_stress(temp_db, num_tasks, max_views):
    """
    Stress-test atomic_try_increment_view_count under high task concurrency.

    Verifies:
    1. Exactly min(num_tasks, max_views) requests succeed (limit_hit=False).
    2. Remaining requests fail with limit_hit=True.
    3. Final database current_views is exactly min(num_tasks, max_views).
    4. Auto-destruction triggers when current_views reaches max_views.
    5. Zero over-allocation occurs regardless of lock contention.
    """
    token = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    future_expires = now + timedelta(hours=24)

    # Insert initial file record with valid future expiration
    created = await temp_db.create_file_record(
        token=token,
        filename="stress_test.txt",
        bar_filename=f"{token}.bar",
        file_path="/tmp/stress_test.bar",
        metadata={
            "filename": "stress_test.txt",
            "created_at": now.isoformat(),
            "expires_at": future_expires.isoformat(),
            "max_views": max_views,
            "current_views": 0,
        },
    )
    assert created is True

    async def _attempt_view():
        return await temp_db.atomic_try_increment_view_count(token)

    # Launch all tasks concurrently
    tasks = [asyncio.create_task(_attempt_view()) for _ in range(num_tasks)]
    results = await asyncio.gather(*tasks)

    expected_success = min(num_tasks, max_views)
    expected_failures = num_tasks - expected_success

    # Return tuple: (db_ok, views_remaining, should_destroy, is_new_view, limit_hit)
    successful = [r for r in results if r[0] is True and r[4] is False]
    failed = [r for r in results if r[0] is True and r[4] is True]

    assert len(successful) == expected_success
    assert len(failed) == expected_failures

    # Verify database state directly
    async with temp_db._sqlite() as db:
        async with db.execute(
            "SELECT current_views, destroyed FROM bar_files WHERE token = ?", (token,)
        ) as cur:
            row = await cur.fetchone()
            assert row is not None
            assert row[0] == expected_success
            if expected_success == max_views:
                assert row[1] == 1  # Marked as destroyed

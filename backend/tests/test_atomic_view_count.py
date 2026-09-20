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


@pytest.mark.asyncio
async def test_atomic_view_increment_and_destruction_atomic_state(temp_db):
    """
    Verify that current_views and destroyed are updated atomically within the same SQL statement,
    preventing any TOCTOU window where current_views == max_views but destroyed == 0.
    """
    token = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    future_expires = now + timedelta(hours=24)

    created = await temp_db.create_file_record(
        token=token,
        filename="toctou_test.txt",
        bar_filename=f"{token}.bar",
        file_path="/tmp/toctou_test.bar",
        metadata={
            "filename": "toctou_test.txt",
            "created_at": now.isoformat(),
            "expires_at": future_expires.isoformat(),
            "max_views": 2,
            "current_views": 0,
        },
    )
    assert created is True

    # 1. First view: current_views -> 1, destroyed remains 0
    db_ok, views_remaining, should_destroy, is_new_view, limit_hit = (
        await temp_db.atomic_try_increment_view_count(token)
    )
    assert db_ok is True
    assert views_remaining == 1
    assert should_destroy is False
    assert is_new_view is True
    assert limit_hit is False

    record_1 = await temp_db.get_file_record(token)
    assert record_1 is not None
    assert record_1["current_views"] == 1
    assert record_1["destroyed"] in (0, False)

    # 2. Second view (reaching max_views): current_views -> 2, destroyed becomes 1 atomically
    db_ok, views_remaining, should_destroy, is_new_view, limit_hit = (
        await temp_db.atomic_try_increment_view_count(token)
    )
    assert db_ok is True
    assert views_remaining == 0
    assert should_destroy is True
    assert is_new_view is True
    assert limit_hit is False

    # Immediate query: get_file_record filters by destroyed = 0, so it must return None
    record_2 = await temp_db.get_file_record(token)
    assert record_2 is None

    # Raw query confirms current_views == 2 and destroyed == 1
    async with temp_db._sqlite() as db:
        async with db.execute(
            "SELECT current_views, destroyed FROM bar_files WHERE token = ?", (token,)
        ) as cur:
            row = await cur.fetchone()
            assert row is not None
            assert row[0] == 2
            assert row[1] == 1

    # 3. Third view attempt: rejected by atomic guard (limit_hit = True)
    db_ok, views_remaining, should_destroy, is_new_view, limit_hit = (
        await temp_db.atomic_try_increment_view_count(token)
    )
    assert db_ok is True
    assert limit_hit is True
    assert views_remaining == 0

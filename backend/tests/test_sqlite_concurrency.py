import os
import asyncio
import pytest
import tempfile
from core.database import Database

@pytest.mark.asyncio
async def test_sqlite_concurrent_writes_and_reads():
    """Verify high-concurrency database writes and reads execute cleanly with SQLitePool."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_file = tmp.name

    try:
        db = Database()
        db.db_path = db_file
        await db.init_db()

        # Create 10 file records concurrently
        async def create_record(i):
            token = f"tok_{i}"
            return await db.create_file_record(
                token=token,
                filename=f"test_{i}.txt",
                bar_filename=f"test_{i}.bar",
                file_path=f"/path/test_{i}.txt",
                metadata={"max_views": 100, "expires_at": None},
                analytics_key_hash=f"hash_{i}",
            )

        create_results = await asyncio.gather(*[create_record(i) for i in range(10)])
        assert all(create_results)

        # 50 concurrent view increments across tokens
        async def increment_view(i):
            token = f"tok_{i % 10}"
            session = f"session_{i}"
            return await db.atomic_try_increment_view_count(
                token=token,
                session_fingerprint=session,
                view_refresh_minutes=0,
                ip_address="127.0.0.1",
                user_agent="pytest",
            )

        inc_results = await asyncio.gather(*[increment_view(i) for i in range(50)])
        for db_ok, views_rem, destroy, is_new, limit_hit in inc_results:
            assert db_ok is True
            assert limit_hit is False
            assert is_new is True

        # Verify records after concurrent updates
        for i in range(10):
            record = await db.get_file_record(f"tok_{i}")
            assert record is not None
            assert record["current_views"] == 5

        await db.close()
    finally:
        if os.path.exists(db_file):
            try:
                os.remove(db_file)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_sqlite_pool_robustness_features():
    """Verify pool size clamping, acquire timeout, and automatic rollback on check-in."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
        db_file = tmp.name

    try:
        db = Database()
        db.db_path = db_file

        # Test pool size clamping (passing max_size=0 or -1 clamps to minimum 2)
        os.environ["SQLITE_POOL_SIZE"] = "0"
        await db.init_db()
        assert db._sqlite_pool.max_size == 2

        # Test acquire timeout when pool is exhausted
        async with db._sqlite_pool.acquire():
            async with db._sqlite_pool.acquire():
                with pytest.raises(TimeoutError):
                    async with db._sqlite_pool.acquire(timeout=0.1):
                        pass

        # Test automatic rollback on checkin after uncommitted statement/exception
        try:
            async with db._sqlite() as conn:
                await conn.execute("BEGIN IMMEDIATE")
                # Intentionally do NOT commit and raise an error
                raise RuntimeError("Simulated crash mid-transaction")
        except RuntimeError:
            pass

        # The connection returned to pool should be clean (rollback called)
        async with db._sqlite() as conn:
            # Should be able to start a new transaction without "cannot start transaction within transaction" error
            await conn.execute("BEGIN IMMEDIATE")
            await conn.execute("COMMIT")

        await db.close()
    finally:
        os.environ.pop("SQLITE_POOL_SIZE", None)
        if os.path.exists(db_file):
            try:
                os.remove(db_file)
            except Exception:
                pass


def test_resolve_sqlite_db_path():
    """Verify resolve_sqlite_db_path anchors relative URLs against BASE_DIR and preserves absolute paths."""
    from core.config import resolve_sqlite_db_path

    # Relative paths resolve to absolute path anchored at BASE_DIR
    p1 = resolve_sqlite_db_path("sqlite:///bar_files.db", base_dir="/app/backend")
    assert p1 == os.path.abspath("/app/backend/bar_files.db")

    p2 = resolve_sqlite_db_path("sqlite:///./bar_files.db", base_dir="/app/backend")
    assert p2 == os.path.abspath("/app/backend/bar_files.db")

    p3 = resolve_sqlite_db_path("sqlite:///data/bar.db", base_dir="/app/backend")
    assert p3 == os.path.abspath("/app/backend/data/bar.db")

    # Absolute paths are preserved
    abs_target = os.path.abspath("/var/lib/data/bar.db")
    p4 = resolve_sqlite_db_path(f"sqlite:///{abs_target}", base_dir="/app/backend")
    assert p4 == abs_target

    # Default fallback path
    p5 = resolve_sqlite_db_path("postgresql://user:pass@host/db", base_dir="/app/backend")
    assert p5 == os.path.abspath("/app/backend/bar_files.db")


def test_client_storage_timezone_handling():
    """Verify client storage creates timezone-aware timestamps and validates expiry correctly."""
    from storage import client_storage
    from datetime import datetime, timedelta, timezone

    # Valid non-expired metadata
    meta = client_storage.create_client_metadata("test.txt", expiry_minutes=10, password_protected=False)
    assert meta["created_at"].endswith("Z")
    assert meta["expires_at"].endswith("Z")
    is_valid, errors = client_storage.validate_client_access(meta)
    assert is_valid is True
    assert len(errors) == 0

    # Expired metadata (10 minutes in past)
    past_iso = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat().replace("+00:00", "Z")
    meta["expires_at"] = past_iso
    is_valid, errors = client_storage.validate_client_access(meta)
    assert is_valid is False
    assert "File has expired" in errors


@pytest.mark.asyncio
async def test_validate_file_size_streaming_unified_limit():
    """Verify validate_file_size_streaming enforces settings.max_file_size single source of truth."""
    from unittest.mock import AsyncMock
    from fastapi import HTTPException
    from core import security
    from core.config import settings

    # Simulated file stream within limit
    mock_file_ok = AsyncMock()
    mock_file_ok.read.side_effect = [b"a" * 1024, b""]
    total = await security.validate_file_size_streaming(mock_file_ok)
    assert total == 1024

    # Simulated file stream exceeding limit
    mock_file_large = AsyncMock()
    mock_file_large.read.side_effect = [b"a" * (settings.max_file_size + 1), b""]
    with pytest.raises(HTTPException) as exc_info:
        await security.validate_file_size_streaming(mock_file_large)
    assert exc_info.value.status_code == 413


def test_cleanup_rate_limit_storage():
    """Verify cleanup_rate_limit_storage handles both list-of-datetime and list-of-dict entries."""
    from datetime import datetime, timedelta, timezone
    from core import security

    old_ts = datetime.now(timezone.utc) - timedelta(seconds=600)
    security.rate_limit_storage["1.2.3.4"] = [old_ts]
    security.password_attempts["1.2.3.4:token"] = [{"timestamp": old_ts, "success": False}]

    res = security.cleanup_rate_limit_storage(max_age_seconds=300)
    assert res["rate_limit"] >= 1
    assert res["password_attempts"] >= 1
    assert "1.2.3.4" not in security.rate_limit_storage
    assert "1.2.3.4:token" not in security.password_attempts

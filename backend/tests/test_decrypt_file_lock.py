"""
Concurrency and multi-process OS-level kernel file locking tests for /decrypt/{bar_id}.
"""

import os
import uuid
import pytest
import pytest_asyncio
import httpx
from fastapi.testclient import TestClient
from app import app
from core.config import settings
from core import security
from utils import crypto_utils


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Clear rate-limiting dictionary before each test to prevent 429 throttling."""
    security.rate_limit_storage.clear()


@pytest.fixture(autouse=True)
def fast_kdf(monkeypatch):
    """Use fewer PBKDF2 iterations in test to keep concurrency stress tests fast."""
    orig = crypto_utils.derive_key_from_password
    monkeypatch.setattr(
        crypto_utils,
        "derive_key_from_password",
        lambda password, salt, iterations=1000: orig(password, salt, iterations=1000),
    )


def create_test_bar_file(target_dir: str, bar_id: str, max_views: int = 1, password: str = "TestPassword123!") -> str:
    """Helper to generate a valid .bar file directly in target_dir."""
    file_content = b"Kernel lock concurrency test payload."
    metadata = {
        "filename": "test_kernel_lock.txt",
        "file_size": len(file_content),
        "mime_type": "text/plain",
        "created_at": "2026-09-21T00:00:00Z",
        "max_views": max_views,
        "current_views": 0,
        "password_protected": True,
        "file_hash": crypto_utils.calculate_file_hash(file_content),
    }

    bar_data, _, _ = crypto_utils.encrypt_and_pack_with_password(
        file_data=file_content,
        metadata=metadata,
        password=password,
    )

    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, f"{bar_id.lower()}.bar")
    with open(file_path, "wb") as f:
        f.write(bar_data)

    return file_path


@pytest.mark.asyncio
async def test_decrypt_concurrent_burn_file_single_winner(tmp_path, monkeypatch):
    """
    Verify that across concurrent requests on a 1-view burn file (max_views=1):
    1. Exactly 1 request succeeds (HTTP 200).
    2. All other concurrent requests fail (HTTP 410 Gone).
    3. The .bar file is destroyed from disk.
    """
    gen_dir = str(tmp_path / "generated")
    monkeypatch.setattr(settings, "generated_dir", gen_dir)
    # Also update FileService's cached real path
    from services.file_service import get_file_service
    fs = get_file_service()
    monkeypatch.setattr(fs, "generated_dir", gen_dir)
    monkeypatch.setattr(fs, "_real_generated_dir", os.path.realpath(gen_dir))

    bar_id = str(uuid.uuid4())
    file_path = create_test_bar_file(gen_dir, bar_id, max_views=1)
    assert os.path.exists(file_path)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        async def _attempt_decrypt(req_idx: int):
            # Use unique fake IP per request so rate limiter doesn't throttle
            headers = {
                "X-Requested-With": "XMLHttpRequest",
                "X-Forwarded-For": f"192.168.1.{req_idx + 10}",
            }
            return await client.post(
                f"/decrypt/{bar_id}",
                json={"password": "TestPassword123!"},
                headers=headers,
            )

        num_requests = 8
        import asyncio
        responses = await asyncio.gather(*[_attempt_decrypt(i) for i in range(num_requests)])

    status_codes = [r.status_code for r in responses]
    assert status_codes.count(200) == 1, f"Expected exactly 1 success, got: {status_codes}"
    non_200 = [s for s in status_codes if s != 200]
    assert len(non_200) == num_requests - 1
    assert all(s in (404, 410) for s in non_200), f"Expected 404 or 410 for destroyed file, got: {status_codes}"

    # Verify file is destroyed on disk
    assert not os.path.exists(file_path)


@pytest.mark.asyncio
async def test_decrypt_concurrent_multi_view_enforcement(tmp_path, monkeypatch):
    """
    Verify that across concurrent requests on a multi-view file (max_views=3):
    1. Exactly 3 requests succeed (HTTP 200).
    2. Remaining requests fail (HTTP 404 or 410 for destroyed file).
    3. The .bar file is destroyed from disk after the 3rd view.
    """
    gen_dir = str(tmp_path / "generated")
    monkeypatch.setattr(settings, "generated_dir", gen_dir)
    from services.file_service import get_file_service
    fs = get_file_service()
    monkeypatch.setattr(fs, "generated_dir", gen_dir)
    monkeypatch.setattr(fs, "_real_generated_dir", os.path.realpath(gen_dir))

    bar_id = str(uuid.uuid4())
    file_path = create_test_bar_file(gen_dir, bar_id, max_views=3)
    assert os.path.exists(file_path)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        async def _attempt_decrypt(req_idx: int):
            headers = {
                "X-Requested-With": "XMLHttpRequest",
                "X-Forwarded-For": f"192.168.2.{req_idx + 10}",
            }
            return await client.post(
                f"/decrypt/{bar_id}",
                json={"password": "TestPassword123!"},
                headers=headers,
            )

        num_requests = 7
        import asyncio
        responses = await asyncio.gather(*[_attempt_decrypt(i) for i in range(num_requests)])

    status_codes = [r.status_code for r in responses]
    assert status_codes.count(200) == 3, f"Expected exactly 3 successes, got: {status_codes}"
    non_200 = [s for s in status_codes if s != 200]
    assert len(non_200) == num_requests - 3
    assert all(s in (404, 410) for s in non_200), f"Expected 404 or 410 for destroyed file, got: {status_codes}"

    # Verify file is destroyed on disk
    assert not os.path.exists(file_path)


def _mp_worker(gen_dir: str, bar_id: str, client_ip: str, res_queue):
    """Worker function executed in a separate process."""
    try:
        from utils import crypto_utils
        orig = crypto_utils.derive_key_from_password
        crypto_utils.derive_key_from_password = lambda password, salt, iterations=1000: orig(password, salt, iterations=1000)

        from core.config import settings
        from services.file_service import get_file_service
        settings.generated_dir = gen_dir
        fs = get_file_service()
        fs.generated_dir = gen_dir
        fs._real_generated_dir = os.path.realpath(gen_dir)

        client = TestClient(app, headers={
            "X-Requested-With": "XMLHttpRequest",
            "X-Forwarded-For": client_ip,
        })
        res = client.post(f"/decrypt/{bar_id}", json={"password": "TestPassword123!"})
        res_queue.put(res.status_code)
    except Exception as e:
        res_queue.put(str(e))


def test_decrypt_multiprocess_kernel_lock(tmp_path, monkeypatch):
    """
    Multi-process test simulating distinct worker processes (e.g. Gunicorn / Uvicorn workers).
    Verifies OS-level kernel file locking synchronizes view counting across process boundaries.
    """
    import multiprocessing
    gen_dir = str(tmp_path / "generated")
    monkeypatch.setattr(settings, "generated_dir", gen_dir)
    from services.file_service import get_file_service
    fs = get_file_service()
    monkeypatch.setattr(fs, "generated_dir", gen_dir)
    monkeypatch.setattr(fs, "_real_generated_dir", os.path.realpath(gen_dir))

    bar_id = str(uuid.uuid4())
    file_path = create_test_bar_file(gen_dir, bar_id, max_views=1)
    assert os.path.exists(file_path)

    queue = multiprocessing.Queue()
    num_procs = 4
    procs = [
        multiprocessing.Process(
            target=_mp_worker,
            args=(gen_dir, bar_id, f"192.168.3.{i + 10}", queue)
        )
        for i in range(num_procs)
    ]

    for p in procs:
        p.start()
    for p in procs:
        p.join(timeout=10)

    results = []
    while not queue.empty():
        results.append(queue.get())

    assert len(results) == num_procs
    assert results.count(200) == 1, f"Expected 1 process to succeed, got results: {results}"
    non_200 = [s for s in results if s != 200]
    assert len(non_200) == num_procs - 1
    assert all(s in (404, 410) for s in non_200), f"Expected 404 or 410 for destroyed file, got: {results}"
    import time
    for _ in range(50):
        if not os.path.exists(file_path):
            break
        time.sleep(0.05)
    assert not os.path.exists(file_path)


@pytest.mark.asyncio
async def test_decrypt_expired_file_rejected_and_deleted(tmp_path, monkeypatch):
    """
    Verify that an expired .bar file in decrypt_bar:
    1. Returns HTTP 403 with 'File has expired'.
    2. Is automatically destroyed / deleted from disk.
    """
    from datetime import datetime, timezone, timedelta
    gen_dir = str(tmp_path / "generated")
    monkeypatch.setattr(settings, "generated_dir", gen_dir)
    from services.file_service import get_file_service
    fs = get_file_service()
    monkeypatch.setattr(fs, "generated_dir", gen_dir)
    monkeypatch.setattr(fs, "_real_generated_dir", os.path.realpath(gen_dir))

    bar_id = str(uuid.uuid4())
    file_content = b"Expired payload"
    # Create file with expires_at in the past
    past_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    metadata = {
        "filename": "expired_test.txt",
        "file_size": len(file_content),
        "mime_type": "text/plain",
        "created_at": "2026-09-20T00:00:00Z",
        "expires_at": past_time,
        "max_views": 5,
        "current_views": 0,
        "password_protected": True,
        "file_hash": crypto_utils.calculate_file_hash(file_content),
    }
    bar_data, _, _ = crypto_utils.encrypt_and_pack_with_password(
        file_data=file_content,
        metadata=metadata,
        password="TestPassword123!",
    )
    os.makedirs(gen_dir, exist_ok=True)
    file_path = os.path.join(gen_dir, f"{bar_id.lower()}.bar")
    with open(file_path, "wb") as f:
        f.write(bar_data)
    assert os.path.exists(file_path)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            f"/decrypt/{bar_id}",
            json={"password": "TestPassword123!"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert res.status_code == 403
        assert "expired" in res.json().get("detail", "").lower()

    # Verify expired file was destroyed from disk
    assert not os.path.exists(file_path)


@pytest.mark.asyncio
async def test_decrypt_should_destroy_headers_present(tmp_path, monkeypatch):
    """
    Verify that X-BAR-Should-Destroy and X-BAR-Destroyed headers are both present
    on successful decryption when should_destroy is True.
    """
    gen_dir = str(tmp_path / "generated")
    monkeypatch.setattr(settings, "generated_dir", gen_dir)
    from services.file_service import get_file_service
    fs = get_file_service()
    monkeypatch.setattr(fs, "generated_dir", gen_dir)
    monkeypatch.setattr(fs, "_real_generated_dir", os.path.realpath(gen_dir))

    bar_id = str(uuid.uuid4())
    file_path = create_test_bar_file(gen_dir, bar_id, max_views=1)
    assert os.path.exists(file_path)

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            f"/decrypt/{bar_id}",
            json={"password": "TestPassword123!"},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )
        assert res.status_code == 200
        assert res.headers.get("x-bar-should-destroy") == "true"
        assert res.headers.get("x-bar-destroyed") == "true"
        assert res.headers.get("x-bar-views-remaining") == "0"
        assert res.headers.get("x-bar-view-only") == "false"
        assert res.headers.get("x-bar-filename") == "test_kernel_lock.txt"
        assert "filename" in res.headers.get("x-bar-metadata", "")


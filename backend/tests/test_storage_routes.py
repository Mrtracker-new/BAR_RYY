"""
End-to-end integration and failure path test suite for storage API routes.
"""

import io
import uuid
import pytest
from fastapi.testclient import TestClient
from app import app
from core.config import settings
from core import security


@pytest.fixture(autouse=True)
def reset_rate_limits():
    """Clear rate-limiting dictionary before each test to prevent 429 throttling."""
    security.rate_limit_storage.clear()


@pytest.fixture
def client():
    """FastAPI TestClient instance configured with CSRF headers."""
    with TestClient(app, headers={"X-Requested-With": "XMLHttpRequest"}) as test_client:
        yield test_client


def test_storage_routes_happy_path(client):
    """Test full happy-path storage flow: upload -> seal -> analytics -> share decrypt."""
    file_content = b"Integration test payload data 12345."
    file_name = "integration_test.txt"

    # 1. Upload temporary file
    upload_res = client.post(
        "/upload",
        files={"file": (file_name, io.BytesIO(file_content), "text/plain")},
    )
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert upload_data["success"] is True
    temp_filename = upload_data["temp_filename"]

    # 2. Seal file with password
    password = "IntegrationPassword123!"
    seal_res = client.post(
        "/seal",
        json={
            "temp_filename": temp_filename,
            "original_filename": file_name,
            "password": password,
            "max_views": 5,
            "ttl_days": 1,
            "storage_mode": "server",
        },
    )
    assert seal_res.status_code == 200
    seal_data = seal_res.json()
    assert seal_data["success"] is True
    token = seal_data["access_token"]
    analytics_key = seal_data["analytics_key"]
    assert token is not None

    # 3. Retrieve analytics using X-Analytics-Key header
    analytics_res = client.get(
        f"/analytics/{token}",
        headers={"X-Analytics-Key": analytics_key},
    )
    assert analytics_res.status_code == 200
    analytics_data = analytics_res.json()
    assert "total_accesses" in analytics_data

    # 4. Decrypt / access file via share route
    share_res = client.post(
        f"/share/{token}",
        json={"password": password},
    )
    assert share_res.status_code == 200
    assert share_res.content == file_content
    assert share_res.headers.get("Content-Type") in ("application/octet-stream", "text/plain")


def test_share_incorrect_password(client):
    """Verify share decrypt route returns 401 Unauthorized when given a wrong password."""
    file_content = b"Top secret data."
    file_name = "secret.txt"

    upload_res = client.post(
        "/upload",
        files={"file": (file_name, io.BytesIO(file_content), "text/plain")},
    )
    assert upload_res.status_code == 200
    temp_filename = upload_res.json()["temp_filename"]

    password = "RightPassword123!"
    seal_res = client.post(
        "/seal",
        json={
            "temp_filename": temp_filename,
            "original_filename": file_name,
            "password": password,
            "max_views": 5,
            "ttl_days": 1,
            "storage_mode": "server",
        },
    )
    assert seal_res.status_code == 200
    token = seal_res.json()["access_token"]

    # Attempt decrypt with wrong password
    decrypt_res = client.post(
        f"/share/{token}",
        json={"password": "WrongPassword999!"},
    )
    assert decrypt_res.status_code in (401, 403)


def test_share_non_existent_token(client):
    """Verify share route returns 404 for a non-existent or invalid token."""
    random_token = str(uuid.uuid4())
    share_res = client.post(
        f"/share/{random_token}",
        json={"password": "SomePassword123!"},
    )
    assert share_res.status_code == 404


def test_seal_missing_temp_file(client):
    """Verify seal route returns 404 when given a non-existent temp_filename."""
    fake_temp_filename = f"{uuid.uuid4()}__non_existent_file.txt"
    seal_res = client.post(
        "/seal",
        json={
            "temp_filename": fake_temp_filename,
            "original_filename": "non_existent_file.txt",
            "password": "Password123!",
            "max_views": 1,
            "ttl_days": 1,
        },
    )
    assert seal_res.status_code == 404


def test_share_view_limit_exhaustion_and_burn(client):
    """Verify file self-destructs (410 Gone) after max_views limit is reached."""
    file_content = b"Single-view burn payload."
    file_name = "burn.txt"

    upload_res = client.post(
        "/upload",
        files={"file": (file_name, io.BytesIO(file_content), "text/plain")},
    )
    assert upload_res.status_code == 200
    temp_filename = upload_res.json()["temp_filename"]

    password = "BurnPassword123!"
    seal_res = client.post(
        "/seal",
        json={
            "temp_filename": temp_filename,
            "original_filename": file_name,
            "password": password,
            "max_views": 1,  # Single view only
            "ttl_days": 1,
            "storage_mode": "server",
        },
    )
    assert seal_res.status_code == 200
    token = seal_res.json()["access_token"]

    # First view succeeds
    decrypt_res1 = client.post(
        f"/share/{token}",
        json={"password": password},
    )
    assert decrypt_res1.status_code == 200
    assert decrypt_res1.content == file_content

    # Second view fails (file burned)
    decrypt_res2 = client.post(
        f"/share/{token}",
        json={"password": password},
    )
    assert decrypt_res2.status_code in (404, 410)


def test_upload_oversized_file(client, monkeypatch):
    """Verify /upload rejects files exceeding max_file_size with 413 Payload Too Large."""
    monkeypatch.setattr(settings, "max_file_size", 100)  # 100 bytes limit
    large_content = b"X" * 200

    upload_res = client.post(
        "/upload",
        files={"file": ("large.txt", io.BytesIO(large_content), "text/plain")},
    )
    assert upload_res.status_code == 413

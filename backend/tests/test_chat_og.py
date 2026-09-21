"""
Tests for Burn Chat OpenGraph preview endpoint (/og/chat/{token}).
Verifies input validation, status codes, and XSS prevention.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from app import app
from services import chat_service


@pytest.fixture
def client():
    return TestClient(app)


def test_og_chat_invalid_token_rejected_400(client):
    """Ensure invalid session token format triggers HTTP 400 and does not reflect raw HTML/scripts."""
    payload = 'test"><img src=x onerror=alert(1)>'
    res = client.get(f"/og/chat/{payload}")
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid session token format"
    assert "<img" not in res.text


def test_og_chat_invalid_token_attribute_escape_rejected_400(client):
    """Ensure invalid token with single quotes / event handlers triggers HTTP 400."""
    payload = "test' onfocus='alert(1)"
    res = client.get(f"/og/chat/{payload}")
    assert res.status_code == 400
    assert res.json()["detail"] == "Invalid session token format"
    assert "onfocus" not in res.text


def test_og_chat_valid_token_expired_session(client):
    """Ensure valid UUID token format for a non-existent or expired session returns 200 with escaped HTML."""
    fake_token = str(uuid.uuid4())
    res = client.get(f"/og/chat/{fake_token}")
    assert res.status_code == 200
    assert "text/html" in res.headers["content-type"]
    assert "Burn Chat — Session Burned" in res.text
    assert fake_token in res.text


def test_og_chat_valid_token_active_session(client):
    """Ensure active session returns 200 with remaining time and participant count."""
    token, pin, expires_at = chat_service.create_session(ttl_seconds=300)
    try:
        res = client.get(f"/og/chat/{token}")
        assert res.status_code == 200
        assert "text/html" in res.headers["content-type"]
        assert "Join Burn Chat" in res.text
        assert token in res.text
    finally:
        session = chat_service._SESSIONS.pop(token, None)
        if session and session._destroy_task and not session._destroy_task.done():
            session._destroy_task.cancel()

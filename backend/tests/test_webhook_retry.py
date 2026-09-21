"""
Tests for WebhookService retry logic with exponential backoff on HTTP 5xx and timeouts.
"""

import asyncio
import socket
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock, call
from services import webhook_service


@pytest.fixture
def mock_dns_safe():
    """Mock socket.getaddrinfo to always return a safe public IP."""
    fake_addrinfo = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 80))]
    with patch("socket.getaddrinfo", return_value=fake_addrinfo):
        yield


@pytest.mark.asyncio
async def test_webhook_retry_recovers_from_5xx(mock_dns_safe):
    """Verify that send_webhook retries on HTTP 5xx and succeeds when a subsequent attempt succeeds."""
    service = webhook_service.WebhookService(retry_delays=(0.01, 0.02))

    resp_500 = httpx.Response(status_code=500, request=httpx.Request("POST", "https://example.com/webhook"))
    resp_200 = httpx.Response(status_code=200, request=httpx.Request("POST", "https://example.com/webhook"))

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[resp_500, resp_200])
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://example.com/webhook",
            event_type="tamper_alert",
            data={"file": "test.txt"},
        )

        assert success is True
        assert error is None
        assert mock_client.post.call_count == 2
        mock_sleep.assert_called_once_with(0.01)

    await service.close()


@pytest.mark.asyncio
async def test_webhook_retry_exhausted_on_5xx(mock_dns_safe):
    """Verify that send_webhook stops after exhausting max attempts on continuous 5xx."""
    service = webhook_service.WebhookService(retry_delays=(0.01, 0.02))

    resp_503 = httpx.Response(status_code=503, request=httpx.Request("POST", "https://example.com/webhook"))

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[resp_503, resp_503, resp_503])
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://example.com/webhook",
            event_type="tamper_alert",
            data={"file": "test.txt"},
        )

        assert success is False
        assert error == "Webhook returned status 503"
        assert mock_client.post.call_count == 3
        assert mock_sleep.call_count == 2
        mock_sleep.assert_has_calls([call(0.01), call(0.02)], any_order=False)

    await service.close()


@pytest.mark.asyncio
async def test_webhook_retry_recovers_from_timeout(mock_dns_safe):
    """Verify that send_webhook retries on timeout errors and succeeds when a subsequent attempt succeeds."""
    service = webhook_service.WebhookService(retry_delays=(0.01, 0.02))

    resp_204 = httpx.Response(status_code=204, request=httpx.Request("POST", "https://example.com/webhook"))

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[httpx.ReadTimeout("Read timed out"), resp_204])
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://example.com/webhook",
            event_type="tamper_alert",
            data={"file": "test.txt"},
        )

        assert success is True
        assert error is None
        assert mock_client.post.call_count == 2
        mock_sleep.assert_called_once_with(0.01)

    await service.close()


@pytest.mark.asyncio
async def test_webhook_retry_exhausted_on_timeout(mock_dns_safe):
    """Verify that send_webhook stops after exhausting max attempts on continuous timeout."""
    service = webhook_service.WebhookService(retry_delays=(0.01, 0.02))

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[
            httpx.ConnectTimeout("Connect timed out"),
            asyncio.TimeoutError(),
            httpx.ReadTimeout("Read timed out"),
        ])
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://example.com/webhook",
            event_type="tamper_alert",
            data={"file": "test.txt"},
        )

        assert success is False
        assert error == "Webhook request timed out"
        assert mock_client.post.call_count == 3
        assert mock_sleep.call_count == 2
        mock_sleep.assert_has_calls([call(0.01), call(0.02)], any_order=False)

    await service.close()


@pytest.mark.asyncio
async def test_webhook_no_retry_on_4xx(mock_dns_safe):
    """Verify that send_webhook does NOT retry on client error (HTTP 4xx)."""
    service = webhook_service.WebhookService(retry_delays=(0.01, 0.02))

    resp_400 = httpx.Response(status_code=400, request=httpx.Request("POST", "https://example.com/webhook"))

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=resp_400)
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://example.com/webhook",
            event_type="tamper_alert",
            data={"file": "test.txt"},
        )

        assert success is False
        assert error == "Webhook returned status 400"
        assert mock_client.post.call_count == 1
        mock_sleep.assert_not_called()

    await service.close()


@pytest.mark.asyncio
async def test_webhook_mixed_5xx_and_timeout_recovery(mock_dns_safe):
    """Verify retry handles a sequence of 5xx, then timeout, then success."""
    service = webhook_service.WebhookService(retry_delays=(0.01, 0.02))

    resp_502 = httpx.Response(status_code=502, request=httpx.Request("POST", "https://example.com/webhook"))
    resp_200 = httpx.Response(status_code=200, request=httpx.Request("POST", "https://example.com/webhook"))

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[
            resp_502,
            httpx.ReadTimeout("Read timed out"),
            resp_200,
        ])
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://example.com/webhook",
            event_type="file_destroyed",
            data={"file": "test.txt"},
        )

        assert success is True
        assert error is None
        assert mock_client.post.call_count == 3
        assert mock_sleep.call_count == 2

    await service.close()


@pytest.mark.asyncio
async def test_send_tamper_alert_uses_retry(mock_dns_safe):
    """Verify that high-level helper send_tamper_alert triggers retry logic."""
    service = webhook_service.WebhookService(retry_delays=(0.01, 0.02))

    resp_500 = httpx.Response(status_code=500, request=httpx.Request("POST", "https://example.com/webhook"))
    resp_200 = httpx.Response(status_code=200, request=httpx.Request("POST", "https://example.com/webhook"))

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[resp_500, resp_200])
        mock_get_client.return_value = mock_client

        success, error = await service.send_tamper_alert(
            webhook_url="https://example.com/webhook",
            filename="secret.pdf",
            token="abcdef1234567890",
        )

        assert success is True
        assert error is None
        assert mock_client.post.call_count == 2
        mock_sleep.assert_called_once_with(0.01)

    await service.close()


@pytest.mark.asyncio
async def test_default_retry_delays_are_1s_and_2s():
    """Verify that default WebhookService initialization sets retry_delays to (1.0, 2.0)."""
    service = webhook_service.WebhookService()
    assert service.retry_delays == (1.0, 2.0)
    await service.close()


@pytest.mark.asyncio
async def test_webhook_retry_on_429_with_retry_after(mock_dns_safe):
    """Verify that HTTP 429 triggers retry and respects Retry-After header."""
    service = webhook_service.WebhookService(retry_delays=(0.01, 0.02))

    resp_429 = httpx.Response(
        status_code=429,
        headers={"Retry-After": "0.05"},
        request=httpx.Request("POST", "https://discord.com/api/webhooks/test")
    )
    resp_200 = httpx.Response(
        status_code=200,
        request=httpx.Request("POST", "https://discord.com/api/webhooks/test")
    )

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[resp_429, resp_200])
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://discord.com/api/webhooks/test",
            event_type="tamper_alert",
            data={"test": "data"},
        )

        assert success is True
        assert error is None
        assert mock_client.post.call_count == 2
        mock_sleep.assert_called_once_with(0.05)

    await service.close()


@pytest.mark.asyncio
async def test_webhook_retry_on_transient_network_error(mock_dns_safe):
    """Verify that non-SSRF network errors (e.g. connection reset) are retried."""
    service = webhook_service.WebhookService(retry_delays=(0.01, 0.02))

    resp_200 = httpx.Response(
        status_code=200,
        request=httpx.Request("POST", "https://example.com/webhook")
    )

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[
            httpx.ConnectError("Connection reset by peer"),
            resp_200,
        ])
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://example.com/webhook",
            event_type="tamper_alert",
            data={"test": "data"},
        )

        assert success is True
        assert error is None
        assert mock_client.post.call_count == 2
        mock_sleep.assert_called_once_with(0.01)

    await service.close()


@pytest.mark.asyncio
async def test_webhook_ssrf_connect_error_fails_immediately_without_retry(mock_dns_safe):
    """Verify that SSRF Guard connect errors fail immediately without retry."""
    service = webhook_service.WebhookService(retry_delays=(0.01, 0.02))

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=httpx.ConnectError("SSRF Guard: IP 127.0.0.1 is internal/restricted"))
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://example.com/webhook",
            event_type="tamper_alert",
            data={"test": "data"},
        )

        assert success is False
        assert "SSRF guard" in error or "SSRF Guard" in error
        assert mock_client.post.call_count == 1
        mock_sleep.assert_not_called()

    await service.close()


def test_discord_embed_field_sanitization():
    """Verify Discord embed formatting sanitizes empty values, truncates >1024 chars, and caps fields at 25."""
    service = webhook_service.WebhookService()

    data = {
        "empty_field": "",
        "none_field": None,
        "whitespace_field": "   ",
        "long_field": "x" * 2000,
    }
    # Add extra fields to exceed 25
    for i in range(30):
        data[f"extra_{i}"] = f"value_{i}"

    payload = service._format_discord_webhook("tamper_alert", data)
    embed = payload["embeds"][0]
    fields = embed["fields"]

    assert len(fields) <= 25
    field_dict = {f["name"]: f["value"] for f in fields}
    assert field_dict["Empty Field"] == "N/A"
    assert field_dict["None Field"] == "N/A"
    assert field_dict["Whitespace Field"] == "N/A"
    assert len(field_dict["Long Field"]) <= 1024
    assert field_dict["Long Field"].endswith("...")


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [200, 201, 202, 204])
async def test_webhook_success_codes_2xx(mock_dns_safe, status_code):
    """Verify that all standard 2xx success codes (200, 201, 202, 204) are treated as successes."""
    service = webhook_service.WebhookService(retry_delays=(0.01,))

    resp = httpx.Response(status_code=status_code, request=httpx.Request("POST", "https://example.com/webhook"))

    with patch.object(service, "_get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=resp)
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://example.com/webhook",
            event_type="file_accessed",
            data={"test": "data"},
        )

        assert success is True
        assert error is None
        assert mock_client.post.call_count == 1

    await service.close()


@pytest.mark.asyncio
async def test_webhook_retry_after_capped_at_30s(mock_dns_safe):
    """Verify that an excessive Retry-After header (e.g. 3600s) is capped at 30.0s."""
    service = webhook_service.WebhookService(retry_delays=(0.01,))

    resp_429 = httpx.Response(
        status_code=429,
        headers={"Retry-After": "3600"},
        request=httpx.Request("POST", "https://example.com/webhook")
    )
    resp_200 = httpx.Response(
        status_code=200,
        request=httpx.Request("POST", "https://example.com/webhook")
    )

    with patch.object(service, "_get_client") as mock_get_client, \
         patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=[resp_429, resp_200])
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="https://example.com/webhook",
            event_type="tamper_alert",
            data={"test": "data"},
        )

        assert success is True
        assert mock_client.post.call_count == 2
        mock_sleep.assert_called_once_with(30.0)

    await service.close()


@pytest.mark.asyncio
async def test_webhook_authoritative_fields_cannot_be_overwritten(mock_dns_safe):
    """Verify that caller-supplied data cannot overwrite event or service in generic payloads."""
    service = webhook_service.WebhookService()

    resp_200 = httpx.Response(status_code=200, request=httpx.Request("POST", "https://custom-api.com/webhook"))

    with patch.object(service, "_get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=resp_200)
        mock_get_client.return_value = mock_client

        await service.send_webhook(
            webhook_url="https://custom-api.com/webhook",
            event_type="tamper_alert",
            data={
                "event": "clobbered_event",
                "service": "fake_service",
                "custom_key": "custom_val",
            },
        )

        call_kwargs = mock_client.post.call_args.kwargs
        sent_payload = call_kwargs["json"]
        assert sent_payload["event"] == "tamper_alert"
        assert sent_payload["service"] == "BAR Web"
        assert sent_payload["custom_key"] == "custom_val"

    await service.close()


@pytest.mark.asyncio
async def test_webhook_url_whitespace_trimmed(mock_dns_safe):
    """Verify that leading and trailing whitespace on webhook_url is trimmed."""
    service = webhook_service.WebhookService()

    resp_200 = httpx.Response(status_code=200, request=httpx.Request("POST", "https://example.com/webhook"))

    with patch.object(service, "_get_client") as mock_get_client:
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=resp_200)
        mock_get_client.return_value = mock_client

        success, error = await service.send_webhook(
            webhook_url="   https://example.com/webhook   \n",
            event_type="tamper_alert",
            data={"test": "data"},
        )

        assert success is True
        assert mock_client.post.call_args[0][0] == "https://example.com/webhook"

    await service.close()



"""
SSRF security guard and URL validation test suite.
"""

import socket
import pytest
from unittest.mock import patch
from core import security
from services import webhook_service


@pytest.mark.parametrize(
    "resolved_ip,expected_safe",
    [
        ("93.184.216.34", True),     # Public IPv4 (example.com)
        ("127.0.0.1", False),        # Loopback IPv4
        ("10.0.0.1", False),         # Private Class A
        ("172.16.0.1", False),       # Private Class B
        ("192.168.1.1", False),      # Private Class C
        ("169.254.169.254", False),  # Link-local / AWS metadata IMDSv1
        ("::1", False),              # Loopback IPv6
        ("fc00::1", False),          # Unique local IPv6 (fc00::/7)
        ("fd00::1", False),          # Unique local IPv6 (fd00::/7)
        ("fe80::1", False),          # Link-local IPv6
        ("::ffff:127.0.0.1", False), # IPv4-mapped IPv6 loopback
        ("::ffff:10.0.0.1", False),  # IPv4-mapped IPv6 private
        ("64:ff9b::5db8:d822", True), # NAT64 mapped public IP (93.184.216.34)
        ("64:ff9b::7f00:1", False),  # NAT64 mapped loopback (127.0.0.1)
        ("64:ff9b::a9fe:a9fe", False), # NAT64 mapped link-local (169.254.169.254)
        ("64:ff9b::a00:1", False),   # NAT64 mapped private (10.0.0.1)
    ],
    ids=[
        "public_ip",
        "loopback_v4",
        "private_class_a",
        "private_class_b",
        "private_class_c",
        "link_local_aws_metadata",
        "loopback_v6",
        "unique_local_v6_fc",
        "unique_local_v6_fd",
        "link_local_v6",
        "v4_mapped_loopback",
        "v4_mapped_private",
        "nat64_mapped_public",
        "nat64_mapped_loopback",
        "nat64_mapped_metadata",
        "nat64_mapped_private",
    ],
)
def test_ssrf_safe_url_mocked_dns_resolution(resolved_ip, expected_safe):
    """Verify _ssrf_safe_url blocks internal, loopback, link-local, and mapped IPv6 addresses."""
    # Mock socket.getaddrinfo to return resolved_ip
    fake_addrinfo = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (resolved_ip, 80))]

    with patch("socket.getaddrinfo", return_value=fake_addrinfo):
        is_safe = webhook_service._ssrf_safe_url("http://example.com/webhook")
        assert is_safe == expected_safe


@pytest.mark.parametrize(
    "invalid_url",
    [
        "file:///etc/passwd",
        "gopher://127.0.0.1:70/_",
        "ftp://internal-server.local/data",
        "dict://127.0.0.1:11211/stat",
        "ldap://localhost:389",
        "http://",
        "https://",
        "not_a_url",
    ],
    ids=[
        "file_scheme",
        "gopher_scheme",
        "ftp_scheme",
        "dict_scheme",
        "ldap_scheme",
        "http_no_host",
        "https_no_host",
        "raw_string",
    ],
)
def test_ssrf_safe_url_invalid_schemes_and_malformed(invalid_url):
    """Verify _ssrf_safe_url rejects non-HTTP/HTTPS schemes and malformed URLs."""
    assert webhook_service._ssrf_safe_url(invalid_url) is False


@pytest.mark.parametrize(
    "alt_ip_url",
    [
        "http://2130706433/",      # Decimal 127.0.0.1
        "http://0x7f000001/",      # Hex 127.0.0.1
        "http://0177.0000.0000.0001/", # Octal 127.0.0.1
        "http://017700000001/",    # Single octal integer 127.0.0.1
    ],
    ids=["decimal_ip", "hex_ip", "octal_dotted", "octal_integer"],
)
def test_validate_webhook_url_alternative_ip_notations(alt_ip_url):
    """Verify validate_webhook_url blocks alternative IP representations of internal addresses."""
    # Ensure validate_webhook_url returns False for internal alternative IP representations
    assert security.validate_webhook_url(alt_ip_url) is False


def test_validate_webhook_url_empty_is_optional():
    """Verify validate_webhook_url returns True for empty/None input as webhooks are optional."""
    assert security.validate_webhook_url("") is True
    assert security.validate_webhook_url(None) is True


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "rebound_ip",
    [
        "127.0.0.1",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "::1",
        "fc00::1",
    ],
    ids=[
        "rebind_loopback_v4",
        "rebind_private_10",
        "rebind_private_172",
        "rebind_private_192",
        "rebind_link_local_metadata",
        "rebind_loopback_v6",
        "rebind_unique_local_v6",
    ],
)
async def test_dns_rebinding_toctou_prevention(rebound_ip):
    """
    Verify that if a domain resolves to a public IP at pre-check time (_ssrf_safe_url),
    but rebinds to an internal/restricted IP at TCP connect time, the SSRF-safe
    transport blocks the connection immediately at socket creation.
    """
    service = webhook_service.WebhookService()

    # Call 1 (pre-check _ssrf_safe_url): returns public IP 93.184.216.34
    # Call 2 (connect-time _SSRFSafeBackend): returns rebound internal IP
    dns_responses = [
        [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 80))],
        [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (rebound_ip, 80))],
    ]

    def mock_getaddrinfo(*args, **kwargs):
        if dns_responses:
            return dns_responses.pop(0)
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (rebound_ip, 80))]

    with patch("socket.getaddrinfo", side_effect=mock_getaddrinfo):
        success, error = await service.send_webhook(
            webhook_url="http://attacker-rebind.com/webhook",
            event_type="tamper_alert",
            data={"test": "data"},
        )
        assert success is False
        assert error is not None
        assert "SSRF guard" in error or "SSRF Guard" in error

    await service.close()


@pytest.mark.asyncio
async def test_ssrf_safe_transport_direct_internal_ip_blocked():
    """Verify that direct connection attempts to internal IPs are blocked at connect time."""
    service = webhook_service.WebhookService()
    success, error = await service.send_webhook(
        webhook_url="http://127.0.0.1:8080/webhook",
        event_type="tamper_alert",
        data={"test": "data"},
    )
    assert success is False
    assert error is not None
    assert "SSRF guard" in error or "SSRF Guard" in error
    await service.close()


"""
tests/test_analytics_security.py
---------------------------------
Unit and security regression tests for services/analytics.py.
Specifically verifies:
1. get_client_ip spoofing resistance (right-to-left XFF parsing)
2. Direct connection vs trusted reverse-proxy handling
3. X-Real-IP fallback behavior
4. get_device_type classification
"""

from __future__ import annotations

from unittest.mock import MagicMock
import pytest
from services import analytics


def _make_request(
    client_host: str = "127.0.0.1",
    headers: dict[str, str] | None = None,
) -> MagicMock:
    """Helper to construct a mock FastAPI/Starlette Request."""
    req = MagicMock()
    req.client = MagicMock()
    req.client.host = client_host
    req.headers = headers or {}
    return req


# ---------------------------------------------------------------------------
# get_client_ip: Direct connection (untrusted peer)
# ---------------------------------------------------------------------------

class TestGetClientIpDirectConnection:
    """
    When the direct TCP peer (request.client.host) is NOT a trusted proxy,
    X-Forwarded-For and X-Real-IP MUST be completely ignored to prevent
    IP spoofing and rate-limit bypass.
    """

    def test_untrusted_peer_ignores_xff(self):
        # 203.0.113.10 is a public untrusted IP (not in Render default CIDRs)
        req = _make_request(
            client_host="203.0.113.10",
            headers={"X-Forwarded-For": "1.2.3.4, 5.6.7.8"},
        )
        assert analytics.get_client_ip(req) == "203.0.113.10"

    def test_untrusted_peer_ignores_x_real_ip(self):
        req = _make_request(
            client_host="198.51.100.42",
            headers={"X-Real-IP": "8.8.8.8"},
        )
        assert analytics.get_client_ip(req) == "198.51.100.42"

    def test_untrusted_peer_without_headers(self):
        req = _make_request(client_host="198.51.100.42")
        assert analytics.get_client_ip(req) == "198.51.100.42"

    def test_missing_client_host(self):
        req = MagicMock()
        req.client = None
        req.headers = {"X-Forwarded-For": "1.2.3.4"}
        assert analytics.get_client_ip(req) == "Unknown"

    @pytest.mark.parametrize(
        "private_ip",
        [
            "10.0.0.1",
            "10.244.0.5",
            "172.16.0.1",
            "172.17.0.2",
            "172.31.255.254",
            "192.168.0.1",
            "192.168.1.100",
        ],
    )
    def test_rfc1918_private_peers_cannot_spoof_xff(self, private_ip: str):
        """
        RFC 1918 subnets must NOT be trusted by default. Direct container/VPC
        peers cannot inject arbitrary IPs via X-Forwarded-For or X-Real-IP.
        """
        req_xff = _make_request(
            client_host=private_ip,
            headers={"X-Forwarded-For": "1.2.3.4, 5.6.7.8"},
        )
        assert analytics.get_client_ip(req_xff) == private_ip

        req_x_real_ip = _make_request(
            client_host=private_ip,
            headers={"X-Real-IP": "8.8.8.8"},
        )
        assert analytics.get_client_ip(req_x_real_ip) == private_ip


# ---------------------------------------------------------------------------
# get_client_ip: Behind trusted proxy (Loopback / Explicitly Configured)
# ---------------------------------------------------------------------------

class TestGetClientIpBehindTrustedProxy:
    """
    When the direct TCP peer IS a trusted proxy (e.g. 127.0.0.1 by default,
    or explicitly configured CIDRs), parse X-Forwarded-For from right to left
    to find the first untrusted IP.
    """

    def test_trusted_peer_single_client_ip(self):
        # Direct peer is 127.0.0.1 (trusted loopback)
        req = _make_request(
            client_host="127.0.0.1",
            headers={"X-Forwarded-For": "203.0.113.195"},
        )
        assert analytics.get_client_ip(req) == "203.0.113.195"

    def test_trusted_peer_right_to_left_spoofing_mitigation(self):
        """
        Attacker injects '1.2.3.4', real client is '203.0.113.50',
        and proxy appended '127.0.0.1'.
        Right-to-left parsing must pick '203.0.113.50', NOT the attacker's '1.2.3.4'.
        """
        req = _make_request(
            client_host="127.0.0.1",
            headers={"X-Forwarded-For": "1.2.3.4, 203.0.113.50, 127.0.0.1"},
        )
        assert analytics.get_client_ip(req) == "203.0.113.50"

    def test_trusted_peer_all_trusted_proxies_fallback(self):
        """
        If all IPs in the XFF chain are within trusted networks,
        it falls back to the leftmost IP.
        """
        req = _make_request(
            client_host="127.0.0.1",
            headers={"X-Forwarded-For": "127.0.0.1, 127.0.0.1"},
        )
        assert analytics.get_client_ip(req) == "127.0.0.1"

    def test_trusted_peer_x_real_ip_fallback(self):
        """
        When XFF is empty but X-Real-IP is provided from a trusted peer.
        """
        req = _make_request(
            client_host="127.0.0.1",
            headers={"X-Real-IP": "203.0.113.88"},
        )
        assert analytics.get_client_ip(req) == "203.0.113.88"

    def test_trusted_peer_malformed_ips_handled_safely(self):
        """
        Malformed strings in X-Forwarded-For do not raise exceptions
        and valid IPs are still parsed.
        """
        req = _make_request(
            client_host="127.0.0.1",
            headers={"X-Forwarded-For": "not-an-ip, 203.0.113.77, invalid-again"},
        )
        assert analytics.get_client_ip(req) == "203.0.113.77"

    def test_explicit_trusted_proxy_cidrs_configuration(self, monkeypatch):
        """
        When TRUSTED_PROXY_CIDRS is explicitly configured in production (e.g. for Render/AWS ALB),
        connections from those configured proxy CIDRs are trusted.
        """
        monkeypatch.setenv("TRUSTED_PROXY_CIDRS", "10.0.0.0/8,172.16.0.0/12")
        custom_networks = analytics._load_trusted_networks()
        monkeypatch.setattr(analytics, "_TRUSTED_NETWORKS", custom_networks)

        req = _make_request(
            client_host="10.0.0.1",
            headers={"X-Forwarded-For": "1.2.3.4, 203.0.113.50, 10.0.0.2"},
        )
        assert analytics.get_client_ip(req) == "203.0.113.50"

    def test_trusted_proxy_cidrs_none(self, monkeypatch):
        """
        When TRUSTED_PROXY_CIDRS is 'none', proxy headers from loopback are also ignored.
        """
        monkeypatch.setenv("TRUSTED_PROXY_CIDRS", "none")
        custom_networks = analytics._load_trusted_networks()
        monkeypatch.setattr(analytics, "_TRUSTED_NETWORKS", custom_networks)

        req = _make_request(
            client_host="127.0.0.1",
            headers={"X-Forwarded-For": "203.0.113.50"},
        )
        assert analytics.get_client_ip(req) == "127.0.0.1"


# ---------------------------------------------------------------------------
# get_device_type tests
# ---------------------------------------------------------------------------

class TestGetDeviceType:
    @pytest.mark.parametrize(
        "ua,expected",
        [
            ("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)", "Mobile"),
            ("Mozilla/5.0 (Linux; Android 13; SM-S901B)", "Mobile"),
            ("Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)", "Tablet"),
            ("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Desktop"),
            ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "Desktop"),
            ("Mozilla/5.0 (X11; Linux x86_64)", "Desktop"),
            ("Googlebot/2.1 (+http://www.google.com/bot.html)", "Bot"),
            ("", "Unknown"),
            ("CustomClient/1.0", "Unknown"),
        ],
    )
    def test_classification(self, ua: str, expected: str):
        assert analytics.get_device_type(ua) == expected

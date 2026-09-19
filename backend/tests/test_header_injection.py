"""
HTTP header safety, CRLF injection prevention, and metadata sanitization test suite.
"""

import json
import pytest
from core import security


@pytest.mark.parametrize(
    "filename,disposition",
    [
        ("report\r\nX-Injected: true.pdf", "attachment"),
        ("document\nSet-Cookie: session=stolen.pdf", "attachment"),
        ("file\x00name.png", "inline"),
        ("file\x85nextline.docx", "attachment"),
        ("file\u2028separator.zip", "attachment"),
        ("file\u2029paragraph.tar.gz", "attachment"),
    ],
    ids=[
        "crlf_carriage_return",
        "crlf_line_feed",
        "null_byte",
        "unicode_next_line",
        "unicode_line_separator",
        "unicode_paragraph_separator",
    ],
)
def test_build_content_disposition_crlf_injection_stripping(filename, disposition):
    """Verify build_content_disposition strips all line-terminating and null characters."""
    header = security.build_content_disposition(filename, disposition)
    assert "\r" not in header
    assert "\n" not in header
    assert "\x00" not in header
    assert "\x85" not in header
    assert "\u2028" not in header
    assert "\u2029" not in header
    assert header.startswith(disposition)


@pytest.mark.parametrize(
    "filename",
    [
        '"malicious_file".jpg',
        r"path\to\escaped_file.png",
        'nested"quotes"inside\\backslashes.pdf',
    ],
    ids=["quotes", "backslashes", "nested_quotes_and_backslashes"],
)
def test_build_content_disposition_quote_escaping(filename):
    """Verify build_content_disposition backslash-escapes double quotes and backslashes."""
    header = security.build_content_disposition(filename)
    assert header.startswith("attachment; filename=")
    # Ensure quotes inside filename parameter are escaped with backslash
    assert r'\"' in header or r'\\' in header


@pytest.mark.parametrize(
    "filename",
    [
        "résumé_📄.pdf",
        "öäü_über.txt",
        "🔥_secret_file.bar",
        "中文_测试_文档.docx",
    ],
    ids=["french_emoji", "german_umlaut", "flame_emoji", "chinese_unicode"],
)
def test_build_content_disposition_unicode_and_rfc5987(filename):
    """Verify build_content_disposition formats non-ASCII filenames using RFC 5987 / 8187 UTF-8 encoding."""
    header = security.build_content_disposition(filename)
    assert "filename*=" in header
    assert "UTF-8''" in header


@pytest.mark.parametrize(
    "filename",
    [
        "",
        ".",
        "..",
        "A" * 8192,
        "CON",
        "PRN",
        "AUX",
        "NUL",
        "file_\u202E_exe.pdf",
    ],
    ids=[
        "empty",
        "dot",
        "dotdot",
        "8kb_long",
        "win_con",
        "win_prn",
        "win_aux",
        "win_nul",
        "rtl_override",
    ],
)
def test_build_content_disposition_edge_case_filenames(filename):
    """Verify build_content_disposition safely handles empty, long, reserved, and RTL override filenames."""
    header = security.build_content_disposition(filename)
    assert "\r" not in header
    assert "\n" not in header
    assert len(header) < 1000  # Filename is truncated defensively


def test_build_content_disposition_invalid_disposition_type():
    """Verify build_content_disposition raises ValueError for invalid disposition strings."""
    with pytest.raises(ValueError):
        security.build_content_disposition("doc.pdf", disposition="inline; type=text/html")


def test_build_safe_metadata_header_sensitive_field_stripping():
    """Verify build_safe_metadata_header strips sensitive fields and retains only allowlisted keys."""
    raw_metadata = {
        "filename": "confidential.pdf",
        "created_at": "2026-07-28T00:00:00Z",
        "expires_at": "2026-07-29T00:00:00Z",
        "max_views": 5,
        "current_views": 1,
        "storage_mode": "client",
        "password_hash": "$2b$12$eImiTXuWVxfM37uY4JANjO...",
        "webhook_url": "https://internal.net/webhook",
        "file_hash": "a1b2c3d4e5f6...",
        "encryption_method": "password_derived",
        "otp_emails": ["secret@domain.com"],
        "analytics_key_hash": "deadbeef1234...",
    }

    header_json = security.build_safe_metadata_header(raw_metadata)
    parsed = json.loads(header_json)

    # Allowed keys
    assert parsed["filename"] == "confidential.pdf"
    assert parsed["created_at"] == "2026-07-28T00:00:00Z"
    assert parsed["max_views"] == 5
    assert parsed["current_views"] == 1
    assert parsed["storage_mode"] == "client"

    # Sensitive keys MUST be omitted
    assert "password_hash" not in parsed
    assert "webhook_url" not in parsed
    assert "file_hash" not in parsed
    assert "encryption_method" not in parsed
    assert "otp_emails" not in parsed
    assert "analytics_key_hash" not in parsed


def test_sanitize_header_value():
    """Verify sanitize_header_value strips all CRLF, null, and Unicode line-terminating characters."""
    unsafe = "line1\r\nline2\x00line3\x85line4\u2028line5\u2029line6"
    sanitized = security.sanitize_header_value(unsafe)
    assert sanitized == "line1line2line3line4line5line6"

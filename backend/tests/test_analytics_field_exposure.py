"""
tests/test_analytics_field_exposure.py
--------------------------------------
Regression tests for CWE-200 / information-disclosure fixes in the
analytics endpoint.

These tests are *static* — they verify the allowlist and blocklist
constants at import time, with no database or network I/O required.

Run from the backend directory:
    pytest tests/test_analytics_field_exposure.py -v
"""

from __future__ import annotations

import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.database import _PUBLIC_FILE_COLUMNS, _FORBIDDEN_RESPONSE_FIELDS


# ── Allowlist tests ──────────────────────────────────────────────────────────

# Fields that must NEVER be included in the analytics allowlist.
# Add to this set if new internal/sensitive columns are introduced.
_FIELDS_THAT_MUST_NOT_BE_PUBLIC = frozenset({
    "file_path",          # server filesystem path (CWE-200)
    "bar_filename",       # redundant; leaks naming convention
    "analytics_key_hash", # derived secret
    "otp_emails",         # PII
})


class TestPublicFileColumns:
    """Verify _PUBLIC_FILE_COLUMNS does not expose sensitive fields."""

    @pytest.mark.parametrize("field", sorted(_FIELDS_THAT_MUST_NOT_BE_PUBLIC))
    def test_sensitive_field_not_in_allowlist(self, field: str) -> None:
        assert field not in _PUBLIC_FILE_COLUMNS, (
            f"{field!r} must NOT appear in _PUBLIC_FILE_COLUMNS — "
            f"it is an internal / sensitive field"
        )

    def test_no_field_contains_path(self) -> None:
        """No column name containing 'path' should ever be public."""
        path_fields = [col for col in _PUBLIC_FILE_COLUMNS if "path" in col.lower()]
        assert path_fields == [], (
            f"_PUBLIC_FILE_COLUMNS contains path-related field(s): {path_fields}"
        )


# ── Forbidden-response-fields tests ─────────────────────────────────────────

class TestForbiddenResponseFields:
    """Verify _FORBIDDEN_RESPONSE_FIELDS catches dangerous fields."""

    @pytest.mark.parametrize("field", sorted(_FIELDS_THAT_MUST_NOT_BE_PUBLIC))
    def test_sensitive_field_in_blocklist(self, field: str) -> None:
        assert field in _FORBIDDEN_RESPONSE_FIELDS, (
            f"{field!r} must be present in _FORBIDDEN_RESPONSE_FIELDS "
            f"as a defence-in-depth guard"
        )

    def test_allowlist_and_blocklist_are_disjoint(self) -> None:
        """If a field is forbidden it must not also be in the allowlist."""
        overlap = _FORBIDDEN_RESPONSE_FIELDS.intersection(_PUBLIC_FILE_COLUMNS)
        assert overlap == set(), (
            f"Fields appear in BOTH the allowlist and the blocklist — "
            f"remove them from _PUBLIC_FILE_COLUMNS: {overlap}"
        )

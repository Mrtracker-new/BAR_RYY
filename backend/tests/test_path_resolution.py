"""
Path resolution and traversal security guard test suite.
"""

import os
import uuid
import pytest
from services.file_service import FileService


@pytest.fixture
def file_service_tmp(tmp_path):
    """FileService instance configured with temporary upload and generated directories."""
    upload_dir = tmp_path / "uploads"
    generated_dir = tmp_path / "generated"
    upload_dir.mkdir()
    generated_dir.mkdir()

    fs = FileService()
    fs.upload_dir = str(upload_dir)
    fs.generated_dir = str(generated_dir)
    fs._real_upload_dir = os.path.realpath(str(upload_dir))
    fs._real_generated_dir = os.path.realpath(str(generated_dir))
    return fs


def test_resolve_temp_file_valid_token(file_service_tmp):
    """Verify resolve_temp_file resolves a valid existing upload file inside upload_dir."""
    valid_uuid = str(uuid.uuid4())
    temp_filename = f"{valid_uuid}__safe_document.pdf"
    file_path = os.path.join(file_service_tmp.upload_dir, temp_filename)

    with open(file_path, "wb") as fh:
        fh.write(b"Dummy payload")

    resolved = file_service_tmp.resolve_temp_file(temp_filename)
    assert resolved is not None
    assert os.path.isabs(resolved)
    assert resolved == os.path.realpath(file_path)


@pytest.mark.parametrize(
    "bad_token",
    [
        "../../etc/passwd",
        r"..\..\Windows\system32\cmd.exe",
        r"..\/..\/etc/passwd",
        "%2e%2e/",
        "%2e%2e%2f",
        "..\u2215..",
        "..\u2216..",
        r"C:\Windows\System32\cmd.exe",
        r"\\server\share\file.txt",
        "",
        ".",
        "..",
        "non_existent_file.txt",
    ],
    ids=[
        "posix_traversal",
        "windows_traversal",
        "mixed_separators",
        "url_encoded_slash",
        "url_encoded_backslash",
        "unicode_slash",
        "unicode_backslash",
        "windows_drive",
        "unc_path",
        "empty",
        "dot",
        "dotdot",
        "non_existent",
    ],
)
def test_resolve_temp_file_traversal_negative_cases(file_service_tmp, bad_token):
    """Verify resolve_temp_file rejects all path traversal and invalid token inputs."""
    resolved = file_service_tmp.resolve_temp_file(bad_token)
    assert resolved is None


def test_get_bar_file_path_valid_uuid4(file_service_tmp):
    """Verify get_bar_file_path resolves a valid existing .bar file in generated_dir."""
    valid_uuid = str(uuid.uuid4())
    bar_file_path = os.path.join(file_service_tmp.generated_dir, f"{valid_uuid}.bar")

    with open(bar_file_path, "wb") as fh:
        fh.write(b"Dummy BAR payload")

    # Lowercase match
    resolved_lower = file_service_tmp.get_bar_file_path(valid_uuid.lower())
    assert resolved_lower is not None
    assert resolved_lower == os.path.realpath(bar_file_path)

    # Uppercase match
    resolved_upper = file_service_tmp.get_bar_file_path(valid_uuid.upper())
    assert resolved_upper is not None
    assert resolved_upper == os.path.realpath(bar_file_path)


@pytest.mark.parametrize(
    "bad_bar_id",
    [
        "not-a-uuid",
        "00000000-0000-0000-0000-000000000000",
        "12345678-1234-4234-8234",
        "SELECT * FROM bar_files",
        "../../secret",
        r"..\..\Windows",
        r"C:\Windows\System32",
        r"\\server\share",
        "",
        ".",
        "..",
        str(uuid.uuid4()),  # Well-formed UUID4 but file does not exist on disk
    ],
    ids=[
        "non_uuid_str",
        "nil_uuid",
        "incomplete_uuid",
        "sqli_payload",
        "posix_traversal",
        "windows_traversal",
        "windows_drive",
        "unc_path",
        "empty",
        "dot",
        "dotdot",
        "absent_uuid4",
    ],
)
def test_get_bar_file_path_negative_cases(file_service_tmp, bad_bar_id):
    """Verify get_bar_file_path rejects non-UUID4 strings, path traversals, and non-existent files."""
    resolved = file_service_tmp.get_bar_file_path(bad_bar_id)
    assert resolved is None

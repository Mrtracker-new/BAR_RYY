"""File operations service."""
import os
import re
import uuid
import json
import base64
import logging
from io import BytesIO
from datetime import datetime, timezone
from typing import Optional, Tuple
from fastapi import UploadFile, HTTPException

logger = logging.getLogger(__name__)

# Suffix appended to the UUID (not the full filename) for the sidecar file.
# This is an internal implementation detail — never exposed to the client.
_UPLOAD_META_SUFFIX = ".upload_meta.json"

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

from core.config import settings
from core import security


# UUID4 format: 8-4-4-4-12 hex digits, version nibble = 4,
# variant nibble ∈ {8, 9, a, b}  (RFC 4122 §4.4).
# Compiled once at module load, not per-request.
_UUID4_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    re.IGNORECASE,
)


class FileService:
    """Service for file operations like upload, preview generation, etc."""

    def __init__(self):
        self.upload_dir = settings.upload_dir
        self.generated_dir = settings.generated_dir

        # Resolve the canonical real paths once at startup.
        # os.path.realpath is an OS-level syscall (lstat chain); calling it on
        # every request inside get_bar_file_path / resolve_temp_file would be
        # pure waste since these directories never change at runtime.
        # Caching them here also ensures the containment check is performed
        # against a consistent anchor even if the process working directory
        # changes (e.g. in some test harnesses).
        self._real_upload_dir: str = os.path.realpath(self.upload_dir)
        self._real_generated_dir: str = os.path.realpath(self.generated_dir)

    async def save_uploaded_file(
        self,
        file: UploadFile,
        validate: bool = True
    ) -> Tuple[str, str, int, Optional[str]]:
        """
        Save an uploaded file to the upload directory.

        Args:
            file: FastAPI UploadFile object
            validate: Whether to validate filename and extension

        Returns:
            Tuple of (file_id, safe_filename, file_size, preview_data)

        Raises:
            HTTPException: If validation fails or file is too large
        """
        if validate:
            # Validate filename
            if not security.validate_filename(file.filename):
                raise HTTPException(status_code=400, detail="Invalid filename")

            # Validate file extension
            if not security.validate_file_extension(file.filename):
                raise HTTPException(status_code=400, detail="File type not allowed")

        # Sanitize filename
        safe_filename = security.sanitize_filename(file.filename)

        # Generate unique file ID
        file_id = str(uuid.uuid4())
        temp_filename = f"{file_id}__{safe_filename}"
        temp_path = os.path.join(self.upload_dir, temp_filename)

        # Save file with size limit
        file_size = 0
        chunk_size = 1024 * 1024  # 1MB chunks

        with open(temp_path, "wb") as buffer:
            while chunk := await file.read(chunk_size):
                file_size += len(chunk)
                if file_size > settings.max_file_size:
                    # Clean up partial file
                    buffer.close()
                    os.remove(temp_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Maximum size is {settings.max_file_size // (1024*1024)}MB"
                    )
                buffer.write(chunk)

        # Write tamper-resistant sidecar with the authoritative server-generated
        # upload timestamp.  This is used by cleanup_old_uploads() instead of
        # os.path.getmtime() (E-07: mtime is user-controllable via touch -t).
        self._write_upload_meta(file_id, safe_filename)

        # Generate preview
        preview_data = self.generate_preview(temp_path, file.content_type)

        return file_id, safe_filename, file_size, preview_data

    def generate_preview(self, file_path: str, content_type: Optional[str]) -> Optional[str]:
        """
        Generate a preview for image files.

        Args:
            file_path: Path to the file
            content_type: MIME type of the file

        Returns:
            Base64-encoded preview image or None
        """
        if not PIL_AVAILABLE or not content_type:
            return None

        try:
            if content_type.startswith('image/'):
                # Image preview
                img = Image.open(file_path)
                # Create thumbnail (max 300x300)
                img.thumbnail((300, 300), Image.Resampling.LANCZOS)
                # Convert to base64
                buffer_io = BytesIO()
                img_format = img.format or 'PNG'
                img.save(buffer_io, format=img_format)
                preview_data = f"data:image/{img_format.lower()};base64," + base64.b64encode(buffer_io.getvalue()).decode()
                return preview_data
            elif content_type.startswith('video/'):
                # Video preview - skip for now to avoid heavy dependencies
                print(f"Video upload detected - thumbnail generation skipped")
                return None
        except Exception as e:
            print(f"Preview generation failed: {e}")
            return None

        return None

    # ---------------------------------------------------------------------- #
    # Sidecar timestamp helpers (E-07 fix)                                   #
    # ---------------------------------------------------------------------- #

    def _sidecar_path(self, file_id: str) -> str:
        """Return the absolute path of the sidecar meta file for *file_id*."""
        return os.path.join(self.upload_dir, f"{file_id}{_UPLOAD_META_SUFFIX}")

    def _write_upload_meta(self, file_id: str, safe_filename: str) -> None:
        """
        Atomically write a sidecar JSON file containing the authoritative
        server-generated upload timestamp.

        The write is atomic on POSIX (rename over a tmp) and best-effort on
        Windows (no rename-over-open-file support).  Either way the sidecar is
        created before save_uploaded_file() returns, so cleanup will always
        find it unless someone deletes it manually — in which case cleanup
        falls back to os.path.getctime() as a safe secondary heuristic rather
        than mtime.

        The sidecar is stored in the same directory as the upload so it is
        cleaned up together with the payload in every code path:
          • Normal flow   → seal route calls delete_upload_with_meta()
          • Stale upload  → cleanup_old_uploads() reads it and deletes both
        """
        meta = {
            "file_id": file_id,
            "safe_filename": safe_filename,
            # Authoritative timestamp — set by server clock, never by OS mtime.
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
        }
        sidecar = self._sidecar_path(file_id)
        tmp_path = sidecar + ".tmp"
        try:
            with open(tmp_path, "w", encoding="utf-8") as fh:
                json.dump(meta, fh, separators=(",", ":"))
            # Atomic replacement on POSIX; non-atomic but functionally
            # correct on Windows (os.replace is still safer than open+write).
            os.replace(tmp_path, sidecar)
        except OSError:
            logger.exception(
                "Failed to write upload sidecar for file_id=%s — "
                "cleanup will fall back to ctime for this file.",
                file_id,
            )
            # Non-fatal: do NOT raise.  The upload itself succeeded.

    def read_upload_meta(self, file_id: str) -> Optional[dict]:
        """
        Read the sidecar meta for *file_id*.

        Returns:
            A dict with at least ``uploaded_at`` (ISO-8601 UTC str) on success,
            or ``None`` if the sidecar is missing or corrupt.
        """
        sidecar = self._sidecar_path(file_id)
        try:
            with open(sidecar, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            # Basic schema guard — must contain the timestamp key.
            if "uploaded_at" not in data:
                logger.warning(
                    "Sidecar for file_id=%s is missing 'uploaded_at' key — ignoring.",
                    file_id,
                )
                return None
            return data
        except FileNotFoundError:
            return None
        except (OSError, json.JSONDecodeError):
            logger.exception(
                "Failed to read/parse upload sidecar for file_id=%s.", file_id
            )
            return None

    def delete_upload_sidecar(self, file_id: str) -> None:
        """
        Delete the sidecar meta file for *file_id*, if it exists.

        This is called by the seal route immediately after it moves/reads the
        payload file, ensuring the sidecar never outlives the payload.
        Errors are logged but not raised — the upload itself already succeeded.
        """
        sidecar = self._sidecar_path(file_id)
        try:
            os.remove(sidecar)
        except FileNotFoundError:
            pass  # Already gone — fine
        except OSError:
            logger.exception(
                "Failed to delete upload sidecar for file_id=%s.", file_id
            )

    def resolve_temp_file(self, temp_filename: str) -> Optional[str]:
        """
        Resolve a temp_filename token to an absolute filesystem path.

        This is the secure replacement for the old ``find_uploaded_file``
        method.  Instead of scanning the upload directory and doing a
        suffix match (which is vulnerable to filename collision / confused
        deputy), we construct the path directly from the UUID-prefixed token
        and verify two invariants:

        1. **Path containment** — the resolved path must reside inside
           ``upload_dir``; this prevents path-traversal attacks even if a
           malformed token somehow survived Pydantic validation.
        2. **File existence** — the file must actually be present on disk;
           this avoids leaking information about whether a path exists
           anywhere outside the upload directory.

        Args:
            temp_filename: The full ``<uuid>__<safe_filename>`` token
                           returned by /upload and validated by
                           ``SealRequest.validate_temp_filename``.

        Returns:
            Absolute path string if the file exists inside upload_dir,
            ``None`` otherwise.
        """
        # Construct the candidate path without any directory traversal.
        # os.path.realpath ensures symlinks are resolved too.
        candidate = os.path.realpath(
            os.path.join(self.upload_dir, temp_filename)
        )
        # Containment check: the resolved path must start with the real
        # upload directory.  os.sep suffix avoids a prefix-collision where
        # upload_dir="/uploads" incorrectly allows "/uploads_evil/...".
        # Uses the cached _real_upload_dir computed at __init__ time.
        if not candidate.startswith(self._real_upload_dir + os.sep) and \
                candidate != self._real_upload_dir:
            return None
        if not os.path.isfile(candidate):
            return None
        return candidate

    def get_bar_file_path(self, bar_id: str) -> Optional[str]:
        """
        Resolve a *bar_id* token to an absolute filesystem path within the
        generated-files directory.

        Security model
        --------------
        This replaces the previous implementation that used ``os.listdir()``
        and matched only the first 8 hex characters of the UUID (C-05).  That
        design had two vulnerabilities:

        1. **Partial-token enumeration** — 16^8 ≈ 4.3 billion combinations;
           distributed brute-force is feasible in hours with moderate hardware.
        2. **First-match collision** — any UUID sharing a prefix with a real
           token would match first, potentially returning the wrong file.

        The new implementation:

        * **Validates format** — rejects anything that is not a well-formed
          UUID4 string *before* it ever touches the filesystem.  Regex
          validation is cheap and eliminates entire classes of path-injection
          and enumeration input without relying on OS-level guards.
        * **Constructs the path deterministically** — no directory scan,
          no glob, no partial-prefix matching.  O(1) and immune to directory
          pollution attacks where an attacker plants files with confusable
          names.
        * **Path-traversal containment** — ``os.path.realpath`` resolves all
          ``..`` sequences and symlinks before the containment check, so a
          crafted token cannot escape ``generated_dir`` even if symlinks are
          present.  The ``os.sep`` suffix on the real-dir anchor prevents the
          prefix-collision where ``generated_dir="/gen"`` could incorrectly
          accept ``/gen_evil/...``.
        * **File-existence check** — returns ``None`` rather than a path to a
          directory or special file; avoids open(2) on non-regular-file inodes.

        This mirrors the security properties of :meth:`resolve_temp_file`.

        Args:
            bar_id: BAR file identifier (must be a well-formed UUID4 string).

        Returns:
            Absolute path string if the file exists inside ``generated_dir``,
            ``None`` otherwise.
        """
        # ------------------------------------------------------------------ #
        # 1. Input validation — reject non-UUID4 tokens before touching FS.  #
        #                                                                     #
        # Uses the module-level _UUID4_RE constant (compiled once at import). #
        # UUID4 format: 8-4-4-4-12 lowercase hex, version nibble = 4,        #
        # variant nibble ∈ {8, 9, a, b}  (RFC 4122 §4.4).                   #
        # Uppercase is accepted; normalised to lowercase before path join.    #
        # ------------------------------------------------------------------ #
        if not bar_id or not _UUID4_RE.match(bar_id):
            return None

        # Normalise to lowercase so the path is deterministic regardless of
        # how the caller formatted the UUID.
        bar_id_norm = bar_id.lower()

        # ------------------------------------------------------------------ #
        # 2. Construct and canonicalise the candidate path.                   #
        #                                                                     #
        # os.path.realpath resolves symlinks and any residual ".." components #
        # that slipped through validation (belt-and-suspenders).              #
        # ------------------------------------------------------------------ #
        candidate = os.path.realpath(
            os.path.join(self.generated_dir, f"{bar_id_norm}.bar")
        )

        # ------------------------------------------------------------------ #
        # 3. Containment check — the resolved path must live inside           #
        #    generated_dir; this guards against symlink-based escapes.        #
        #    Uses the cached _real_generated_dir computed at __init__ time.   #
        # ------------------------------------------------------------------ #
        if not candidate.startswith(self._real_generated_dir + os.sep) and \
                candidate != self._real_generated_dir:
            return None

        # ------------------------------------------------------------------ #
        # 4. File-existence check — only regular files are accepted.          #
        # ------------------------------------------------------------------ #
        if not os.path.isfile(candidate):
            return None

        return candidate


# Singleton instance
_file_service: Optional[FileService] = None


def get_file_service() -> FileService:
    """Get the file service singleton instance."""
    global _file_service
    if _file_service is None:
        _file_service = FileService()
    return _file_service

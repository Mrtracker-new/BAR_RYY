"""
Background cleanup task for BAR Web API

Removes:
  - Old temporary uploads (> 1 hour) — age is determined from the sidecar
    timestamp written by file_service.save_uploaded_file() rather than
    os.path.getmtime() (E-07: mtime is manipulable via `touch -t`).
  - Expired server-side .bar files (via database queries)

Timestamp resolution order for upload files
-------------------------------------------
1. Sidecar JSON  ({uuid}.upload_meta.json) — authoritative, server-written,
   not controllable by filesystem users.
2. os.path.getctime() — fallback for uploads created before this fix was
   deployed, or whose sidecar was accidentally deleted.  On POSIX this is
   the *inode-change* time (last chmod/chown/link), NOT the creation time,
   but it is still harder to manipulate than mtime (requires CAP_FOWNER or
   equivalent to reset).  On Windows it IS the creation time.
   Either way it is more trustworthy than mtime.

Orphan cleanup
--------------
Sidecar files that have no matching payload are deleted at the end of each
upload-cleanup cycle.  This handles the edge case where the server crashed
after writing the sidecar but before writing the payload.
"""
import os
import json
import logging
import asyncio
from datetime import datetime, timezone, timedelta

from core import database

logger = logging.getLogger(__name__)

# Directories — must match file_service.py and core/config.py.
UPLOAD_DIR = "uploads"
GENERATED_DIR = "generated"

# Age threshold for temporary uploads (seconds).  Uploads older than this
# are considered stale and eligible for deletion.
UPLOAD_CLEANUP_AGE: int = 3600  # 1 hour

# How often the cleanup loop runs (seconds).
CLEANUP_INTERVAL: int = 600  # 10 minutes

# Suffix used by file_service._write_upload_meta().  Must stay in sync.
_UPLOAD_META_SUFFIX = ".upload_meta.json"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _upload_age_seconds(file_id: str, upload_dir: str) -> float:
    """
    Return the age of the upload identified by *file_id* in seconds.

    Resolution order (E-07 fix):
      1. Sidecar JSON ``{file_id}.upload_meta.json`` → ``uploaded_at`` field.
         Written atomically by file_service at upload time; not affected by
         filesystem mtime manipulation.
      2. ``os.path.getctime()`` — inode-change time (POSIX) / creation time
         (Windows).  Harder to manipulate than mtime; used as a safe fallback
         for uploads that pre-date this fix or whose sidecar is missing.

    Args:
        file_id:    UUID prefix of the upload (the part before ``__``).
        upload_dir: Absolute or relative path to the uploads directory.

    Returns:
        Age in fractional seconds as a float.  Returns +∞ if the file's age
        cannot be determined, which causes it to be treated as stale and
        deleted — this is the safe-fail direction (clean up rather than keep).
    """
    sidecar_path = os.path.join(upload_dir, f"{file_id}{_UPLOAD_META_SUFFIX}")

    # --- Strategy 1: sidecar timestamp ----------------------------------------
    try:
        with open(sidecar_path, "r", encoding="utf-8") as fh:
            meta = json.load(fh)
        uploaded_at_str: str = meta["uploaded_at"]
        # Parse ISO-8601 with timezone; normalise to UTC.
        uploaded_at = datetime.fromisoformat(uploaded_at_str)
        if uploaded_at.tzinfo is None:
            # Shouldn't happen — file_service always writes tz-aware — but
            # guard defensively: assume UTC.
            uploaded_at = uploaded_at.replace(tzinfo=timezone.utc)
        now_utc = datetime.now(timezone.utc)
        return (now_utc - uploaded_at).total_seconds()
    except FileNotFoundError:
        # Sidecar not present — fall through to strategy 2.
        pass
    except (KeyError, ValueError, json.JSONDecodeError, OSError):
        logger.warning(
            "Sidecar for file_id=%s is present but unreadable; "
            "falling back to ctime.",
            file_id,
        )

    # --- Strategy 2: ctime fallback -------------------------------------------
    # Reconstruct any payload path that starts with this file_id in upload_dir.
    # We cannot reconstruct the exact filename because we only have the UUID
    # prefix, so we scan once (O(n) but n is bounded by the upload directory).
    try:
        for entry in os.scandir(upload_dir):
            if entry.is_file() and entry.name.startswith(file_id + "__"):
                ctime = entry.stat().st_ctime
                return datetime.now(timezone.utc).timestamp() - ctime
    except OSError:
        logger.exception("scandir failed in _upload_age_seconds for file_id=%s", file_id)

    # Cannot determine age — treat as infinitely old (safe-fail: delete).
    logger.warning(
        "Cannot determine age for file_id=%s — treating as stale.", file_id
    )
    return float("inf")


def _iter_upload_file_ids(upload_dir: str):
    """
    Yield (file_id, filepath) for every payload file in *upload_dir*.

    Payload files follow the naming convention ``{uuid4}__{safe_filename}``.
    Sidecar files (``{uuid4}.upload_meta.json``) and temp files
    (``*.upload_meta.json.tmp``) are skipped — they are handled separately.

    Yields:
        Tuple of (file_id: str, filepath: str).
    """
    try:
        for entry in os.scandir(upload_dir):
            if not entry.is_file():
                continue
            name = entry.name
            # Skip sidecars and temp writes.
            if name.endswith(_UPLOAD_META_SUFFIX) or name.endswith(
                _UPLOAD_META_SUFFIX + ".tmp"
            ):
                continue
            # Payload files contain exactly one "__" separator.
            if "__" not in name:
                continue
            file_id, _ = name.split("__", 1)
            yield file_id, entry.path
    except OSError:
        logger.exception("Failed to scan upload directory: %s", upload_dir)


def _cleanup_orphan_sidecars(upload_dir: str, seen_file_ids: set) -> int:
    """
    Delete sidecar files whose corresponding payload no longer exists.

    This handles the rare case where the server crashes after writing the
    sidecar but before the payload is committed, or the payload was deleted
    through some out-of-band mechanism.

    Args:
        upload_dir:    Path to the uploads directory.
        seen_file_ids: Set of UUID strings for payloads observed in this run.

    Returns:
        Number of orphan sidecars deleted.
    """
    removed = 0
    try:
        for entry in os.scandir(upload_dir):
            if not entry.is_file():
                continue
            if not entry.name.endswith(_UPLOAD_META_SUFFIX):
                continue
            # Derive the file_id from the sidecar name.
            file_id = entry.name[: -len(_UPLOAD_META_SUFFIX)]
            if file_id not in seen_file_ids:
                try:
                    os.remove(entry.path)
                    removed += 1
                    logger.debug("Removed orphan sidecar: %s", entry.name)
                except OSError:
                    logger.warning(
                        "Failed to remove orphan sidecar: %s", entry.name, exc_info=True
                    )
    except OSError:
        logger.exception("Failed to scan for orphan sidecars in: %s", upload_dir)
    return removed


# ---------------------------------------------------------------------------
# Public cleanup functions
# ---------------------------------------------------------------------------

def cleanup_old_uploads() -> None:
    """
    Remove temporary upload files (and their sidecars) older than
    UPLOAD_CLEANUP_AGE seconds.

    Age is determined from the sidecar timestamp file written by
    file_service.save_uploaded_file() at upload time, not from
    os.path.getmtime() (E-07: mtime is manipulable via `touch -t`).

    Falls back to os.path.getctime() when no sidecar is found (e.g. uploads
    that pre-date this fix).

    At the end of each run, orphaned sidecar files (no matching payload) are
    also cleaned up.
    """
    if not os.path.isdir(UPLOAD_DIR):
        return

    cleaned_payloads = 0
    cleaned_sidecars = 0
    errors = 0
    seen_file_ids: set[str] = set()

    for file_id, filepath in _iter_upload_file_ids(UPLOAD_DIR):
        seen_file_ids.add(file_id)

        try:
            age = _upload_age_seconds(file_id, UPLOAD_DIR)
        except Exception:
            logger.exception("Unexpected error computing age for file_id=%s", file_id)
            errors += 1
            continue

        if age < UPLOAD_CLEANUP_AGE:
            continue  # Still within the keep window — leave it alone.

        # Delete payload.
        try:
            os.remove(filepath)
            cleaned_payloads += 1
            logger.info(
                "Cleaned stale upload: %s (age=%.0fs)", os.path.basename(filepath), age
            )
        except FileNotFoundError:
            pass  # Deleted by the seal route between scan and here — fine.
        except OSError:
            logger.warning(
                "Failed to delete stale upload: %s", filepath, exc_info=True
            )
            errors += 1
            continue  # Don't delete the sidecar if we couldn't delete the payload.

        # Delete matching sidecar.
        sidecar = os.path.join(UPLOAD_DIR, f"{file_id}{_UPLOAD_META_SUFFIX}")
        try:
            os.remove(sidecar)
            cleaned_sidecars += 1
        except FileNotFoundError:
            pass  # Already gone — fine.
        except OSError:
            logger.warning(
                "Failed to delete sidecar for file_id=%s", file_id, exc_info=True
            )

    # Clean up orphan sidecars (payload gone, sidecar remains).
    orphans = _cleanup_orphan_sidecars(UPLOAD_DIR, seen_file_ids)

    if cleaned_payloads or cleaned_sidecars or orphans:
        logger.info(
            "Upload cleanup: %d payload(s), %d sidecar(s), %d orphan sidecar(s) removed%s",
            cleaned_payloads,
            cleaned_sidecars,
            orphans,
            f", {errors} error(s)" if errors else "",
        )
    elif errors:
        logger.warning("Upload cleanup: 0 files removed, %d error(s)", errors)


async def cleanup_expired_bar_files() -> None:
    """Remove expired server-side .bar files using database queries."""
    if not os.path.isdir(GENERATED_DIR):
        return

    from utils import crypto_utils  # local import — avoids circular imports

    cleaned = 0

    try:
        # Expired by time.
        expired_files = await database.db.get_expired_files()
        for file_record in expired_files:
            file_path = file_record["file_path"]
            token = file_record["token"]
            try:
                crypto_utils.delete_file(file_path)
                logger.info(
                    "Deleted expired file: %s (token: %s…)",
                    file_record["filename"],
                    token[:8],
                )
                await database.db.mark_as_destroyed(token)
                cleaned += 1
            except Exception:
                logger.warning(
                    "Failed to clean expired file token=%s…", token[:8], exc_info=True
                )

        # Expired by view count.
        exhausted_files = await database.db.get_exhausted_files()
        for file_record in exhausted_files:
            file_path = file_record["file_path"]
            token = file_record["token"]
            try:
                crypto_utils.delete_file(file_path)
                logger.info(
                    "Deleted exhausted file: %s (token: %s…)",
                    file_record["filename"],
                    token[:8],
                )
                await database.db.mark_as_destroyed(token)
                cleaned += 1
            except Exception:
                logger.warning(
                    "Failed to clean exhausted file token=%s…", token[:8], exc_info=True
                )

        # Purge old destroyed DB records.
        old_records_cleaned = await database.db.cleanup_old_records(days=7)
        if old_records_cleaned > 0:
            logger.info("Purged %d old database record(s)", old_records_cleaned)

        # Trim access_log rows that exceed the per-token cap.
        # This catches historical backlog written before the cap was deployed
        # and any rare ±1 overshoot from the SQLite count-then-insert path.
        pruned_logs = await database.db.prune_access_logs()
        if pruned_logs > 0:
            logger.info(
                "Pruned %d excess access_log row(s) (cap=%d per token)",
                pruned_logs,
                database.ACCESS_LOG_MAX_ROWS,
            )

    except Exception:
        logger.exception("Database cleanup error")

    if cleaned > 0:
        logger.info("Cleaned %d expired/exhausted .bar file(s)", cleaned)


async def run_cleanup_loop() -> None:
    """Main cleanup loop — runs every CLEANUP_INTERVAL seconds."""
    logger.info(
        "Cleanup task started (interval=%ds / %dm)",
        CLEANUP_INTERVAL,
        CLEANUP_INTERVAL // 60,
    )

    while True:
        try:
            logger.info(
                "Running cleanup cycle at %s",
                datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
            )

            # Upload cleanup (sync — I/O is bounded by upload directory size).
            cleanup_old_uploads()

            # BAR file cleanup (async — requires DB queries).
            await cleanup_expired_bar_files()

            logger.info("Cleanup cycle complete")

        except Exception:
            logger.exception("Unexpected error in cleanup loop")

        await asyncio.sleep(CLEANUP_INTERVAL)

"""
Database module for BAR Web - Persistent file metadata tracking

This solves the ephemeral filesystem problem on cloud platforms (Render, etc.)
by storing metadata in a database instead of in the .bar files themselves.

Supports:
- SQLite for local development
- PostgreSQL for production (persistent)
"""
import os
import json
import hashlib
import hmac
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import aiosqlite
from contextlib import asynccontextmanager

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///bar_files.db")
IS_POSTGRES = DATABASE_URL.startswith("postgresql://")

# For production PostgreSQL (Render/cloud), we'll need asyncpg
if IS_POSTGRES:
    try:
        import asyncpg
        HAS_POSTGRES = True
    except ImportError:
        HAS_POSTGRES = False
        print("⚠️ asyncpg not installed - PostgreSQL support disabled")
else:
    HAS_POSTGRES = False


def _hash_analytics_key(raw_key: str) -> str:
    """
    Return the SHA-256 hex digest of a raw analytics key.

    This is the single source of truth for the hashing algorithm.  Calling it
    both at creation time (``encryption_service.py``) and at validation time
    (``get_analytics``) guarantees the algorithm is never applied
    inconsistently.

    SHA-256 (not bcrypt) is appropriate here: the key is already a 256-bit
    CSPRNG token (``secrets.token_urlsafe(32)``), so brute-force is
    computationally infeasible regardless of hash speed.  Bcrypt is a slow KDF
    designed only to protect low-entropy passwords.
    """
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def _verify_analytics_key(stored_hash: Optional[str], supplied_key: str) -> bool:
    """
    Constant-time comparison of the stored SHA-256 hash against the hash of
    the caller-supplied key, preventing timing side-channel attacks.

    The raw analytics key is NEVER stored in the database — only its SHA-256
    digest (``analytics_key_hash`` column).  Validation re-hashes the incoming
    key and compares the two digests with ``hmac.compare_digest`` (constant-time).

    Python's built-in ``!=`` short-circuits on the first differing byte, letting
    an attacker measure response latency to recover the secret character-by-
    character.  ``hmac.compare_digest`` runs in time proportional to the
    *length* of the inputs, not the position of the first mismatch.

    Rules:
    * If no hash was ever stored (``stored_hash`` is None or empty) the
      comparison always fails — there is no valid key to present.
    * Both digest strings are normalised to UTF-8 bytes before comparison.
    """
    if not stored_hash:
        # File was created without analytics; no key is valid.  Use a dummy
        # compare so the function still runs in constant time.
        hmac.compare_digest(b"\x00", b"\x01")
        return False
    try:
        supplied_hash = _hash_analytics_key(supplied_key)
        return hmac.compare_digest(
            stored_hash.encode("utf-8"),
            supplied_hash.encode("utf-8"),
        )
    except (UnicodeEncodeError, AttributeError):
        # Malformed input — reject without leaking information.
        return False


def _normalise_file_record(record: Dict[str, Any]) -> Dict[str, Any]:
    """
    Guarantee that the ``metadata`` field of a raw DB row dict is always a
    ``dict`` before the record leaves the database layer.

    **Why this exists**

    SQLite stores the ``metadata`` column as ``TEXT`` (a serialised JSON
    string).  asyncpg auto-deserialises PostgreSQL ``JSONB`` columns into
    native Python dicts.  Without this normalisation every consumer must add
    its own ``isinstance(meta, str)`` guard — which is how I-10 happened in
    the first place (one call-site was missed).  Fixing the type impedance
    once here, at the single egress point, makes the invariant impossible to
    violate regardless of how many new callers are added in the future.

    **Behaviour**

    * ``str``  → parsed with ``json.loads``; on failure replaced with ``{}``
      and logged at ERROR so operations can investigate without crashing the
      request path.
    * ``None`` → replaced with ``{}`` (handles legacy NULL rows from early
      migrations before the column had a NOT NULL constraint).
    * ``dict`` → returned as-is (PostgreSQL / already-normalised path).

    The function mutates and returns the same dict (no copy overhead).
    """
    raw = record.get("metadata")
    if isinstance(raw, str):
        try:
            record["metadata"] = json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            import logging as _logging
            _logging.getLogger(__name__).error(
                "DB record for token=%r contains unparseable metadata — "
                "replacing with {} to prevent downstream type errors. "
                "Raw value (first 200 chars): %.200r",
                record.get("token"),
                raw,
            )
            record["metadata"] = {}
    elif raw is None:
        record["metadata"] = {}
    # dict path: already correct, nothing to do
    return record


# ---------------------------------------------------------------------------
# Column-level access control for the analytics endpoint
# ---------------------------------------------------------------------------
# This is the single source of truth for which bar_files columns are safe to
# expose through the public-facing analytics API response.
#
# Design rationale
# ----------------
# Rather than fetching every column with SELECT * and then stripping secrets
# after the fact, we embed an explicit allowlist directly into the SQL query.
# This means sensitive values (analytics_key, otp_email) are NEVER loaded into
# Python memory during an analytics request — not just redacted before the
# response is serialised.  Defence-in-depth: a post-fetch pop() is kept as a
# final safety net, but it should never fire under normal operation.
#
# When adding new columns to bar_files:
#   • If the column is safe for analytics consumers → add it here.
#   • If the column is a secret or PII           → do NOT add it here.
_PUBLIC_FILE_COLUMNS: tuple[str, ...] = (
    "token",
    "filename",
    "bar_filename",
    "file_path",
    "metadata",
    "current_views",
    "max_views",
    "expires_at",
    "created_at",
    "last_accessed_at",
    "destroyed",
    "require_otp",
    # analytics_key_hash  ← derived secret: intentionally excluded
    # otp_email           ← PII:            intentionally excluded
)

# Pre-build the SQL fragment once at import time — joining inside a hot path
# on every request would be wasteful, and having it as a constant makes it
# easy to grep/audit.
_PUBLIC_FILE_COLUMNS_SQL: str = ", ".join(
    f"bf.{col}" for col in _PUBLIC_FILE_COLUMNS
)

# Columns that must NEVER appear in any outbound response, used as the
# last-resort post-fetch strip in get_analytics().
_FORBIDDEN_RESPONSE_FIELDS: frozenset[str] = frozenset({
    "analytics_key_hash",  # SHA-256 digest — still a secret, never expose
    "otp_email",
})


class Database:
    """Unified database interface for SQLite and PostgreSQL"""
    
    def __init__(self):
        self.db_path = "bar_files.db"
        self.pool = None
        self.is_postgres = IS_POSTGRES and HAS_POSTGRES
        
    async def init_db(self):
        """Initialize database schema"""
        if self.is_postgres:
            await self._init_postgres()
        else:
            await self._init_sqlite()
    
    async def _init_sqlite(self):
        """Initialize SQLite database"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS bar_files (
                    token TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    bar_filename TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    metadata TEXT NOT NULL,
                    current_views INTEGER DEFAULT 0,
                    max_views INTEGER NOT NULL,
                    expires_at TEXT,
                    created_at TEXT NOT NULL,
                    last_accessed_at TEXT,
                    destroyed BOOLEAN DEFAULT 0,
                    require_otp BOOLEAN DEFAULT 0,
                    otp_email TEXT,
                    analytics_key_hash TEXT   -- SHA-256 hex digest; raw key never persisted
                )
            """)
            
            # Index for cleanup queries
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_expires_at 
                ON bar_files(expires_at)
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_destroyed 
                ON bar_files(destroyed)
            """)
            
            # Access logs table for analytics
            await db.execute("""
                CREATE TABLE IF NOT EXISTS access_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    token TEXT NOT NULL,
                    accessed_at TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT,
                    country TEXT,
                    city TEXT,
                    device_type TEXT,
                    session_fingerprint TEXT,
                    is_counted_as_view INTEGER DEFAULT 1,
                    FOREIGN KEY (token) REFERENCES bar_files(token) ON DELETE CASCADE
                )
            """)
            
            # Basic index on token
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_access_token 
                ON access_logs(token)
            """)
            
            # Composite index for view refresh queries (get_recent_access)
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_access_recent 
                ON access_logs(token, session_fingerprint, accessed_at DESC)
            """)
            
            # Partial index for analytics on counted views
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_access_analytics 
                ON access_logs(token, accessed_at DESC)
                WHERE is_counted_as_view = 1
            """)
            
            await db.commit()
            
            # ── Migration: analytics_key (plaintext) → analytics_key_hash ───────
            # This entire block is idempotent — safe to run on every startup.
            #
            # Phase 1 — ensure the hashed column exists.
            try:
                await db.execute("ALTER TABLE bar_files ADD COLUMN analytics_key_hash TEXT")
                await db.commit()
                print("✅ Migration: added analytics_key_hash column")
            except Exception:
                pass  # Column already exists — safe to ignore

            # Phase 2 — back-fill SHA-256 hash for rows that still have the
            # plaintext key.  We always use a Python-side loop here because
            # SQLite's sha256() SQL function belongs to the optional crypto
            # extension and is NOT present in Python's bundled SQLite build,
            # regardless of the SQLite version number.
            #
            # Guard: if analytics_key was already dropped by a prior migration
            # run, skip back-fill entirely (the column won't exist to SELECT).
            import sqlite3 as _sqlite3
            _sqlite_version = tuple(
                int(x) for x in _sqlite3.sqlite_version.split(".")
            )
            async with db.execute("PRAGMA table_info(bar_files)") as _ci:
                _cols = {row[1] for row in await _ci.fetchall()}
            if "analytics_key" in _cols:
                async with db.execute(
                    "SELECT token, analytics_key FROM bar_files "
                    "WHERE analytics_key IS NOT NULL "
                    "  AND analytics_key != '' "
                    "  AND analytics_key_hash IS NULL"
                ) as _cur:
                    _stale_rows = await _cur.fetchall()
                for _token_val, _raw_key in _stale_rows:
                    _key_hash = _hash_analytics_key(_raw_key)
                    await db.execute(
                        "UPDATE bar_files SET analytics_key_hash = ? WHERE token = ?",
                        (_key_hash, _token_val),
                    )
                await db.commit()

            # Phase 3 — drop the old plaintext column.
            # ALTER TABLE … DROP COLUMN requires SQLite 3.35+.
            if _sqlite_version >= (3, 35, 0):
                try:
                    async with db.execute("PRAGMA table_info(bar_files)") as _cur:
                        _col_info = await _cur.fetchall()
                    _existing_cols = {row[1] for row in _col_info}
                    if "analytics_key" in _existing_cols:
                        await db.execute(
                            "ALTER TABLE bar_files DROP COLUMN analytics_key"
                        )
                        await db.commit()
                        print("✅ Migration: dropped plaintext analytics_key column")
                except Exception as _exc:
                    print(f"⚠️ Could not drop analytics_key column: {_exc}")
            else:
                print(
                    "⚠️  SQLite < 3.35 detected: plaintext analytics_key column "
                    "cannot be auto-dropped — it will be retained but is no longer "
                    "used. Upgrade SQLite to ≥ 3.35 to remove it."
                )

            print("✅ SQLite database initialized")
    
    async def _init_postgres(self):
        """Initialize PostgreSQL database"""
        # Parse DATABASE_URL for asyncpg
        # Supabase uses pgBouncer which requires statement_cache_size=0
        db_url = DATABASE_URL.replace("postgresql://", "")
        
        try:
            # Disable statement cache for pgBouncer compatibility
            self.pool = await asyncpg.create_pool(
                DATABASE_URL, 
                min_size=1, 
                max_size=10,
                statement_cache_size=0
            )
            
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS bar_files (
                        token TEXT PRIMARY KEY,
                        filename TEXT NOT NULL,
                        bar_filename TEXT NOT NULL,
                        file_path TEXT NOT NULL,
                        metadata JSONB NOT NULL,
                        current_views INTEGER DEFAULT 0,
                        max_views INTEGER NOT NULL,
                        expires_at TIMESTAMP,
                        created_at TIMESTAMP NOT NULL,
                        last_accessed_at TIMESTAMP,
                        destroyed BOOLEAN DEFAULT FALSE,
                        require_otp BOOLEAN DEFAULT FALSE,
                        otp_email TEXT,
                        analytics_key_hash TEXT   -- SHA-256 hex digest; raw key never persisted
                    )
                """)
                
                # Indexes for performance
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_expires_at 
                    ON bar_files(expires_at)
                """)
                
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_destroyed 
                    ON bar_files(destroyed)
                """)
                
                # Access logs table for analytics
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS access_logs (
                        id SERIAL PRIMARY KEY,
                        token TEXT NOT NULL,
                        accessed_at TIMESTAMP NOT NULL,
                        ip_address TEXT,
                        user_agent TEXT,
                        country TEXT,
                        city TEXT,
                        device_type TEXT,
                        session_fingerprint TEXT,
                        is_counted_as_view BOOLEAN DEFAULT TRUE,
                        FOREIGN KEY (token) REFERENCES bar_files(token) ON DELETE CASCADE
                    )
                """)
                
                # Basic index on token
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_access_token 
                    ON access_logs(token)
                """)
                
                # Composite index for view refresh queries (get_recent_access)
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_access_recent 
                    ON access_logs(token, session_fingerprint, accessed_at DESC)
                """)
                
                # Partial index for analytics on counted views
                await conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_access_analytics 
                    ON access_logs(token, accessed_at DESC)
                    WHERE is_counted_as_view = TRUE
                """)
                
                # ── Migration: analytics_key (plaintext) → analytics_key_hash ─
                # This block is fully idempotent — safe to run on every startup.
                #
                # Phase 1 — ensure the hashed column exists (no-op if already
                # present; the initial CREATE TABLE already includes it for new
                # deployments).
                await conn.execute("""
                    ALTER TABLE bar_files
                    ADD COLUMN IF NOT EXISTS analytics_key_hash TEXT
                """)

                # Phase 2 — back-fill SHA-256 hash ONLY if the legacy plaintext
                # column still exists.
                #
                # Critical guard: the CREATE TABLE above never includes
                # `analytics_key`, so fresh databases never have it.
                # Running UPDATE … SET … = sha256(analytics_key::bytea) on a
                # table without that column raises
                #   "column analytics_key does not exist"
                # which previously crashed _init_postgres() and caused the
                # SQLite fallback.  We query information_schema first to decide
                # whether the back-fill is needed at all.
                legacy_col_exists: bool = await conn.fetchval("""
                    SELECT EXISTS (
                        SELECT 1
                        FROM   information_schema.columns
                        WHERE  table_name  = 'bar_files'
                          AND  column_name = 'analytics_key'
                    )
                """)

                if legacy_col_exists:
                    # Back-fill rows that have the plaintext key but no hash yet.
                    await conn.execute("""
                        UPDATE bar_files
                        SET    analytics_key_hash =
                                   encode(sha256(analytics_key::bytea), 'hex')
                        WHERE  analytics_key      IS NOT NULL
                          AND  analytics_key_hash IS NULL
                    """)
                    print("✅ Migration: back-filled analytics_key_hash from plaintext column")

                    # Phase 3 — drop the old plaintext column now that every row
                    # has a hash.  DROP COLUMN IF EXISTS is a no-op if it was
                    # already removed by a prior run.
                    await conn.execute("""
                        ALTER TABLE bar_files
                        DROP COLUMN IF EXISTS analytics_key
                    """)
                    print("✅ Migration: dropped plaintext analytics_key column")
                # If legacy_col_exists is False the table was created fresh with
                # only analytics_key_hash — no migration work needed.

            print("✅ PostgreSQL database initialized")
        except Exception as e:
            print(f"⚠️ PostgreSQL init failed: {e}")
            print("   Falling back to SQLite...")
            self.is_postgres = False
            await self._init_sqlite()
    
    async def create_file_record(
        self,
        token: str,
        filename: str,
        bar_filename: str,
        file_path: str,
        metadata: Dict[str, Any],
        require_otp: bool = False,
        otp_email: Optional[str] = None,
        analytics_key_hash: Optional[str] = None
    ) -> bool:
        """Create a new file record in the database.

        ``analytics_key_hash`` must be the SHA-256 hex digest of the raw key
        (produced by ``_hash_analytics_key``).  The raw key must never be
        passed here — it should exist only in the seal response returned to
        the file creator.
        """
        try:
            max_views = metadata.get("max_views", 1)
            expires_at = metadata.get("expires_at")
            created_at = metadata.get("created_at", datetime.now(timezone.utc).isoformat())
            
            if self.is_postgres:
                # Convert to naive UTC datetime for PostgreSQL TIMESTAMP columns
                # (TIMESTAMP doesn't store timezone, so we use naive UTC)
                if expires_at:
                    if isinstance(expires_at, str):
                        expires_str = expires_at.replace('Z', '+00:00')
                        expires_at_dt = datetime.fromisoformat(expires_str)
                        # Convert to naive UTC
                        if expires_at_dt.tzinfo is not None:
                            expires_at_dt = expires_at_dt.astimezone(timezone.utc).replace(tzinfo=None)
                    else:
                        expires_at_dt = expires_at
                        if expires_at_dt.tzinfo is not None:
                            expires_at_dt = expires_at_dt.astimezone(timezone.utc).replace(tzinfo=None)
                else:
                    expires_at_dt = None
                
                if isinstance(created_at, str):
                    created_str = created_at.replace('Z', '+00:00')
                    created_at_dt = datetime.fromisoformat(created_str)
                    # Convert to naive UTC
                    if created_at_dt.tzinfo is not None:
                        created_at_dt = created_at_dt.astimezone(timezone.utc).replace(tzinfo=None)
                else:
                    created_at_dt = created_at
                    if created_at_dt.tzinfo is not None:
                        created_at_dt = created_at_dt.astimezone(timezone.utc).replace(tzinfo=None)
                
                async with self.pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO bar_files 
                        (token, filename, bar_filename, file_path, metadata, 
                         current_views, max_views, expires_at, created_at, require_otp, otp_email,
                         analytics_key_hash)
                        VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10, $11)
                    """, token, filename, bar_filename, file_path, 
                       json.dumps(metadata), max_views, expires_at_dt, created_at_dt, require_otp, otp_email,
                       analytics_key_hash)
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    await db.execute("""
                        INSERT INTO bar_files 
                        (token, filename, bar_filename, file_path, metadata, 
                         current_views, max_views, expires_at, created_at, require_otp, otp_email,
                         analytics_key_hash)
                        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
                    """, (token, filename, bar_filename, file_path, 
                          json.dumps(metadata), max_views, expires_at, created_at, require_otp, otp_email,
                          analytics_key_hash))
                    await db.commit()
            
            return True
        except Exception as e:
            print(f"❌ Failed to create file record: {e}")
            return False
    
    async def get_file_record(self, token: str) -> Optional[Dict[str, Any]]:
        """Get file record by token"""
        try:
            if self.is_postgres:
                async with self.pool.acquire() as conn:
                    row = await conn.fetchrow(
                        "SELECT * FROM bar_files WHERE token = $1 AND destroyed = FALSE",
                        token
                    )
                    if row:
                        return _normalise_file_record(dict(row))
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    db.row_factory = aiosqlite.Row
                    async with db.execute(
                        "SELECT * FROM bar_files WHERE token = ? AND destroyed = 0",
                        (token,)
                    ) as cursor:
                        row = await cursor.fetchone()
                        if row:
                            return _normalise_file_record(dict(row))

            return None
        except Exception as e:
            print(f"❌ Failed to get file record: {e}")
            return None
    
    async def get_recent_access(
        self,
        token: str,
        session_fingerprint: str,
        minutes: int
    ) -> Optional[Dict]:
        """
        Check if this session fingerprint accessed the file within X minutes.
        Used for view refresh control to prevent rapid view consumption.
        
        Returns:
            Dict with access info if found within threshold, None otherwise
        """
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
        
        try:
            if self.is_postgres:
                cutoff_naive = cutoff.replace(tzinfo=None)
                async with self.pool.acquire() as conn:
                    row = await conn.fetchrow("""
                        SELECT * FROM access_logs
                        WHERE token = $1 
                        AND session_fingerprint = $2
                        AND accessed_at > $3
                        AND is_counted_as_view = TRUE
                        ORDER BY accessed_at DESC
                        LIMIT 1
                    """, token, session_fingerprint, cutoff_naive)
                    return dict(row) if row else None
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    db.row_factory = aiosqlite.Row
                    async with db.execute("""
                        SELECT * FROM access_logs
                        WHERE token = ? 
                        AND session_fingerprint = ?
                        AND accessed_at > ?
                        AND is_counted_as_view = 1
                        ORDER BY accessed_at DESC
                        LIMIT 1
                    """, (token, session_fingerprint, cutoff.isoformat())) as cursor:
                        row = await cursor.fetchone()
                        return dict(row) if row else None
        except Exception as e:
            print(f"❌ Failed to get recent access: {e}")
            return None
    
    async def atomic_try_increment_view_count(
        self,
        token: str,
        session_fingerprint: str = None,
        view_refresh_minutes: int = 0,
    ) -> tuple[bool, int, bool, bool, bool]:
        """
        Atomically attempt to increment the view count, guarded by the limit.

        The core of the fix for C-04 (TOCTOU race condition).  A naive
        check-then-act pattern allows two concurrent requests to both read
        ``current_views < max_views`` and both succeed.  Instead, the
        increment is expressed as a single guarded UPDATE:

            UPDATE bar_files
            SET current_views = current_views + 1
            WHERE token = $1
              AND destroyed = FALSE
              AND current_views < max_views   ← CAS guard
            RETURNING current_views, max_views

        If 0 rows are affected the limit was already hit at the DB level —
        no application-level race is possible regardless of concurrency.

        PostgreSQL uses a single RETURNING statement (inherently atomic).
        SQLite uses BEGIN IMMEDIATE which acquires an exclusive write lock
        for the entire transaction, preventing concurrent interleaving.

        Args:
            token: File access token.
            session_fingerprint: Optional session fingerprint for view-refresh
                control.  When supplied and ``view_refresh_minutes > 0``, a
                recent access by the same session skips the increment.
            view_refresh_minutes: Refresh window in minutes (0 = always count).

        Returns:
            5-tuple of ``(db_ok, views_remaining, should_destroy, is_new_view, limit_hit)``:

            * ``db_ok``           – False only on an internal DB error.
            * ``views_remaining`` – Views remaining after this operation.
            * ``should_destroy``  – True when the file should now be deleted.
            * ``is_new_view``     – True when this request counted as a new view.
            * ``limit_hit``       – True when the atomic guard rejected the
                                    request because ``current_views >= max_views``
                                    at the moment of the UPDATE.  The caller
                                    must return 410 to the client without serving
                                    file content.
        """
        try:
            # ── View-refresh deduplication ─────────────────────────────────
            # Check if the same session accessed the file within the refresh
            # window.  This is still a separate DB round-trip, but the worst
            # outcome of a race here is that a repeat viewer is counted once
            # rather than zero times — acceptable and far less severe than
            # the limit-bypass race we are fixing.
            is_new_view = True
            if view_refresh_minutes > 0 and session_fingerprint:
                recent = await self.get_recent_access(
                    token, session_fingerprint, view_refresh_minutes
                )
                is_new_view = (recent is None)

            # ── If not a new view, return current counts without touching DB ─
            if not is_new_view:
                file_record = await self.get_file_record(token)
                if not file_record:
                    return False, 0, False, False, False
                current_views = file_record['current_views']
                max_views    = file_record['max_views']
                views_remaining = max(0, max_views - current_views)
                should_destroy  = current_views >= max_views
                # If should_destroy is True for a refresh-window access it means
                # the file was already exhausted (legacy data or concurrent race).
                # Return limit_hit=True so the caller blocks access rather than
                # serving the file content and deleting it.
                limit_hit = should_destroy
                return True, views_remaining, should_destroy, False, limit_hit

            # ── Atomic guarded increment ───────────────────────────────────
            if self.is_postgres:
                async with self.pool.acquire() as conn:
                    row = await conn.fetchrow("""
                        UPDATE bar_files
                        SET current_views = current_views + 1,
                            last_accessed_at = NOW()
                        WHERE token = $1
                          AND destroyed = FALSE
                          AND current_views < max_views
                        RETURNING current_views, max_views
                    """, token)

                    if row is None:
                        # 0 rows affected — limit already reached (or token
                        # does not exist / already destroyed).  Treat as
                        # limit_hit so caller returns 410 without serving data.
                        # is_new_view=False: no view was counted.
                        return True, 0, False, False, True

                    current_views = row['current_views']
                    max_views     = row['max_views']

            else:
                # SQLite: pass isolation_level=None via connect() kwargs so the
                # underlying sqlite3 connection starts with manual transaction mode
                # (no auto-BEGIN before DML statements).  BEGIN IMMEDIATE then
                # acquires an exclusive write lock, preventing concurrent
                # interleaving between the UPDATE and SELECT changes().
                async with aiosqlite.connect(self.db_path, isolation_level=None) as db:
                    await db.execute("BEGIN IMMEDIATE")
                    try:
                        await db.execute("""
                            UPDATE bar_files
                            SET current_views = current_views + 1,
                                last_accessed_at = ?
                            WHERE token = ?
                              AND destroyed = 0
                              AND current_views < max_views
                        """, (datetime.now(timezone.utc).isoformat(), token))

                        # changes() returns the number of rows touched by the
                        # preceding DML statement within this connection.
                        async with db.execute("SELECT changes()") as cur:
                            affected = (await cur.fetchone())[0]

                        if affected == 0:
                            await db.execute("ROLLBACK")
                            # is_new_view=False: no view was counted.
                            return True, 0, False, False, True

                        async with db.execute(
                            "SELECT current_views, max_views FROM bar_files WHERE token = ?",
                            (token,)
                        ) as cur:
                            row = await cur.fetchone()

                        await db.execute("COMMIT")

                        if not row:
                            return False, 0, False, False, False

                        current_views, max_views = row
                    except Exception:
                        await db.execute("ROLLBACK")
                        raise

            views_remaining = max(0, max_views - current_views)
            should_destroy  = current_views >= max_views

            # Mark as destroyed inside this method so the caller never needs
            # to call mark_as_destroyed() separately — closing a second race
            # window where two concurrent requests could both trigger deletion.
            if should_destroy:
                await self.mark_as_destroyed(token)

            return True, views_remaining, should_destroy, True, False

        except Exception as e:
            print(f"❌ Failed in atomic_try_increment_view_count: {e}")
            return False, 0, False, False, False

    
    async def mark_as_destroyed(self, token: str) -> bool:
        """Mark a file as destroyed"""
        try:
            if self.is_postgres:
                async with self.pool.acquire() as conn:
                    await conn.execute(
                        "UPDATE bar_files SET destroyed = TRUE WHERE token = $1",
                        token
                    )
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    await db.execute(
                        "UPDATE bar_files SET destroyed = 1 WHERE token = ?",
                        (token,)
                    )
                    await db.commit()
            return True
        except Exception as e:
            print(f"❌ Failed to mark as destroyed: {e}")
            return False
    
    async def get_expired_files(self) -> list[Dict[str, Any]]:
        """Get all files that have expired"""
        try:
            now = datetime.now(timezone.utc).isoformat()
            
            if self.is_postgres:
                async with self.pool.acquire() as conn:
                    rows = await conn.fetch("""
                        SELECT * FROM bar_files 
                        WHERE expires_at IS NOT NULL 
                        AND expires_at < NOW()
                        AND destroyed = FALSE
                    """)
                    return [_normalise_file_record(dict(row)) for row in rows]
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    db.row_factory = aiosqlite.Row
                    async with db.execute("""
                        SELECT * FROM bar_files 
                        WHERE expires_at IS NOT NULL 
                        AND expires_at < ?
                        AND destroyed = 0
                    """, (now,)) as cursor:
                        rows = await cursor.fetchall()
                        return [_normalise_file_record(dict(row)) for row in rows]
            
        except Exception as e:
            print(f"❌ Failed to get expired files: {e}")
            return []
    
    async def get_exhausted_files(self) -> list[Dict[str, Any]]:
        """Get all files that have reached max views"""
        try:
            if self.is_postgres:
                async with self.pool.acquire() as conn:
                    rows = await conn.fetch("""
                        SELECT * FROM bar_files 
                        WHERE current_views >= max_views
                        AND destroyed = FALSE
                    """)
                    return [_normalise_file_record(dict(row)) for row in rows]
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    db.row_factory = aiosqlite.Row
                    async with db.execute("""
                        SELECT * FROM bar_files 
                        WHERE current_views >= max_views
                        AND destroyed = 0
                    """) as cursor:
                        rows = await cursor.fetchall()
                        return [_normalise_file_record(dict(row)) for row in rows]
            
        except Exception as e:
            print(f"❌ Failed to get exhausted files: {e}")
            return []
    
    async def cleanup_old_records(self, days: int = 7) -> int:
        """Clean up old destroyed records from database"""
        try:
            now = datetime.now(timezone.utc)
            cutoff_dt = now - timedelta(days=days)
            # Convert to naive UTC for PostgreSQL TIMESTAMP
            cutoff_dt_naive = cutoff_dt.replace(tzinfo=None)
            cutoff_iso = cutoff_dt.isoformat()
            
            if self.is_postgres:
                async with self.pool.acquire() as conn:
                    result = await conn.execute("""
                        DELETE FROM bar_files 
                        WHERE destroyed = TRUE 
                        AND created_at < $1
                    """, cutoff_dt_naive)
                    # Extract count from result
                    return 0  # asyncpg doesn't easily return count
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    cursor = await db.execute("""
                        DELETE FROM bar_files 
                        WHERE destroyed = 1 
                        AND created_at < ?
                    """, (cutoff_iso,))
                    await db.commit()
                    return cursor.rowcount
            
        except Exception as e:
            print(f"❌ Failed to cleanup old records: {e}")
            return 0
    
    async def log_access(
        self,
        token: str,
        ip_address: str,
        user_agent: str,
        country: Optional[str] = None,
        city: Optional[str] = None,
        device_type: Optional[str] = None,
        session_fingerprint: Optional[str] = None,
        is_counted_as_view: bool = True
    ) -> bool:
        """Log a file access for analytics with session tracking."""
        try:
            accessed_at = datetime.now(timezone.utc)
            
            if self.is_postgres:
                accessed_at_naive = accessed_at.replace(tzinfo=None)
                async with self.pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO access_logs 
                        (token, accessed_at, ip_address, user_agent, country, city, 
                         device_type, session_fingerprint, is_counted_as_view)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    """, token, accessed_at_naive, ip_address, user_agent, country, 
                        city, device_type, session_fingerprint, is_counted_as_view)
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    await db.execute("""
                        INSERT INTO access_logs 
                        (token, accessed_at, ip_address, user_agent, country, city, 
                         device_type, session_fingerprint, is_counted_as_view)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (token, accessed_at.isoformat(), ip_address, user_agent, country, 
                          city, device_type, session_fingerprint, is_counted_as_view))
                    await db.commit()
            
            return True
        except Exception as e:
            print(f"❌ Failed to log access: {e}")
            return False
    
    async def get_analytics(self, token: str, analytics_key: str) -> Optional[Dict[str, Any]]:
        """
        Return analytics data for the given file token after validating the
        caller-supplied analytics_key.

        Security architecture
        ---------------------
        Access-control is enforced in two independent layers:

        Layer 1 — Query-time column allowlist
            The SQL SELECT fetches only the columns listed in
            ``_PUBLIC_FILE_COLUMNS``.  ``analytics_key`` and ``otp_email`` are
            never retrieved from the database, so they cannot appear in memory
            at any point during this call.

            Key validation is performed via a *separate*, minimal SELECT that
            fetches only the ``analytics_key`` column.  This keeps the secret
            strictly inside the validation path and out of the data path.

        Layer 2 — Post-fetch field strip (defence-in-depth)
            After the query returns, any column in ``_FORBIDDEN_RESPONSE_FIELDS``
            is unconditionally removed from the dict before it is returned.
            This guard catches future regressions (e.g. someone widens
            ``_PUBLIC_FILE_COLUMNS`` without realising the implication).
        """
        try:
            if self.is_postgres:
                async with self.pool.acquire() as conn:
                    # ── Layer 1a: validate key with a minimal, targeted query ──
                    # Fetch only the secret column — never the full row — so
                    # that a bug in the validation branch cannot accidentally
                    # expose other data.
                    key_row = await conn.fetchrow(
                        "SELECT analytics_key_hash FROM bar_files WHERE token = $1",
                        token,
                    )
                    if not key_row:
                        return None
                    if not _verify_analytics_key(key_row["analytics_key_hash"], analytics_key):
                        return None

                    # ── Layer 1b: fetch only allowlisted public columns ──
                    file_row = await conn.fetchrow(
                        f"SELECT {_PUBLIC_FILE_COLUMNS_SQL}"
                        f" FROM bar_files bf WHERE bf.token = $1",
                        token,
                    )
                    if not file_row:
                        return None

                    # Get access logs
                    log_rows = await conn.fetch(
                        """
                        SELECT id, token, accessed_at, ip_address, user_agent,
                               country, city, device_type, session_fingerprint,
                               is_counted_as_view
                        FROM access_logs
                        WHERE token = $1
                        ORDER BY accessed_at DESC
                        """,
                        token,
                    )
                    logs = [dict(row) for row in log_rows]

            else:
                async with aiosqlite.connect(self.db_path) as db:
                    db.row_factory = aiosqlite.Row

                    # ── Layer 1a: validate key with a minimal, targeted query ──
                    async with db.execute(
                        "SELECT analytics_key_hash FROM bar_files WHERE token = ?",
                        (token,),
                    ) as cursor:
                        key_row = await cursor.fetchone()
                    if not key_row:
                        return None
                    if not _verify_analytics_key(dict(key_row).get("analytics_key_hash"), analytics_key):
                        return None

                    # ── Layer 1b: build the public-column query for SQLite ──
                    # SQLite doesn't support table-qualified column names in
                    # simple SELECT, so strip the "bf." prefix.
                    sqlite_cols = ", ".join(_PUBLIC_FILE_COLUMNS)
                    async with db.execute(
                        f"SELECT {sqlite_cols} FROM bar_files WHERE token = ?",
                        (token,),
                    ) as cursor:
                        file_row = await cursor.fetchone()
                    if not file_row:
                        return None

                    # Get access logs
                    async with db.execute(
                        """
                        SELECT id, token, accessed_at, ip_address, user_agent,
                               country, city, device_type, session_fingerprint,
                               is_counted_as_view
                        FROM access_logs
                        WHERE token = ?
                        ORDER BY accessed_at DESC
                        """,
                        (token,),
                    ) as cursor:
                        log_rows = await cursor.fetchall()
                    logs = [dict(row) for row in log_rows]

            file_info = dict(file_row)

            # ── Layer 2: defence-in-depth field strip ──
            # _PUBLIC_FILE_COLUMNS already excludes these, so under normal
            # operation this is a no-op.  It acts as a regression guard in
            # case the allowlist is widened without careful review.
            leaked = _FORBIDDEN_RESPONSE_FIELDS.intersection(file_info)
            if leaked:
                import logging as _logging
                _logging.getLogger(__name__).error(
                    "SECURITY: forbidden field(s) %s reached get_analytics() "
                    "response dict — stripped before return.  Audit "
                    "_PUBLIC_FILE_COLUMNS immediately.",
                    leaked,
                )
                for field in leaked:
                    file_info.pop(field, None)

            # Normalise metadata to dict (SQLite returns TEXT; PostgreSQL JSONB
            # is already a dict — _normalise_file_record handles both).
            _normalise_file_record(file_info)

            return {
                "file": file_info,
                "access_logs": logs,
                "total_accesses": len(logs),
                "unique_ips": len(
                    set(log.get("ip_address") for log in logs if log.get("ip_address"))
                ),
                "countries": list(
                    set(log.get("country") for log in logs if log.get("country"))
                ),
                "device_types": {
                    device: sum(1 for log in logs if log.get("device_type") == device)
                    for device in set(
                        log.get("device_type") for log in logs if log.get("device_type")
                    )
                },
            }

        except Exception as e:
            print(f"❌ Failed to get analytics: {e}")
            return None
    
    async def close(self):
        """Close database connections"""
        if self.is_postgres and self.pool:
            await self.pool.close()


# Global database instance
db = Database()


async def init_database():
    """Initialize the database on app startup"""
    await db.init_db()


async def close_database():
    """Close database on app shutdown"""
    await db.close()

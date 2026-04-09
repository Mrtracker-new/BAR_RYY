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


def _verify_analytics_key(stored_key: Optional[str], supplied_key: str) -> bool:
    """
    Constant-time comparison of the analytics key to prevent timing side-channel
    attacks.

    Python's built-in string/bytes ``!=`` short-circuits on the first differing
    byte, which lets an attacker measure response latency across thousands of
    requests to recover the key character-by-character.  ``hmac.compare_digest``
    is guaranteed to run in time proportional to the *length* of the inputs, not
    the position of the first mismatch.

    Rules:
    * If no key was ever stored for this file (``stored_key`` is None or empty)
      the comparison always fails — there is no valid key to present.
    * Both values are normalised to UTF-8 bytes before comparison so the
      comparison length is identical regardless of unicode codepoint width.
    """
    if not stored_key:
        # File was created without analytics; no key is valid.  Use a dummy
        # compare so the function still runs in constant time.
        hmac.compare_digest(b"\x00", b"\x01")
        return False
    try:
        return hmac.compare_digest(
            stored_key.encode("utf-8"),
            supplied_key.encode("utf-8"),
        )
    except (UnicodeEncodeError, AttributeError):
        # Malformed input — reject without leaking information.
        return False


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
    # analytics_key  ← secret: intentionally excluded
    # otp_email      ← PII:    intentionally excluded
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
    "analytics_key",
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
                    analytics_key TEXT
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
            
            # Migration: add analytics_key column if it doesn't exist (idempotent)
            try:
                await db.execute("ALTER TABLE bar_files ADD COLUMN analytics_key TEXT")
                await db.commit()
                print("✅ Migrated: added analytics_key column")
            except Exception:
                pass  # Column already exists — safe to ignore
            
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
                        analytics_key TEXT
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
                
                # Migration: add analytics_key column if it doesn't exist
                await conn.execute("""
                    ALTER TABLE bar_files 
                    ADD COLUMN IF NOT EXISTS analytics_key TEXT
                """)
                
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
        analytics_key: Optional[str] = None
    ) -> bool:
        """Create a new file record in the database"""
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
                         analytics_key)
                        VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, $9, $10, $11)
                    """, token, filename, bar_filename, file_path, 
                       json.dumps(metadata), max_views, expires_at_dt, created_at_dt, require_otp, otp_email,
                       analytics_key)
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    await db.execute("""
                        INSERT INTO bar_files 
                        (token, filename, bar_filename, file_path, metadata, 
                         current_views, max_views, expires_at, created_at, require_otp, otp_email,
                         analytics_key)
                        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
                    """, (token, filename, bar_filename, file_path, 
                          json.dumps(metadata), max_views, expires_at, created_at, require_otp, otp_email,
                          analytics_key))
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
                        return dict(row)
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    db.row_factory = aiosqlite.Row
                    async with db.execute(
                        "SELECT * FROM bar_files WHERE token = ? AND destroyed = 0",
                        (token,)
                    ) as cursor:
                        row = await cursor.fetchone()
                        if row:
                            return dict(row)
            
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
    
    async def increment_view_count(
        self,
        token: str,
        session_fingerprint: str = None,
        view_refresh_minutes: int = 0
    ) -> tuple[bool, int, bool, bool]:
        """
        Increment view count for a file with view refresh control support.
        
        Args:
            token: File access token
            session_fingerprint: Optional session fingerprint for refresh control
            view_refresh_minutes: Time threshold in minutes (0 = always increment)
            
        Returns:
            Tuple of (success, views_remaining, should_destroy, is_new_view)
        """
        try:
            is_new_view = True
            
            # Check if within refresh threshold
            if view_refresh_minutes > 0 and session_fingerprint:
                recent = await self.get_recent_access(
                    token,
                    session_fingerprint,
                    view_refresh_minutes
                )
                is_new_view = (recent is None)
            
            if is_new_view:
                # Increment view count
                if self.is_postgres:
                    async with self.pool.acquire() as conn:
                        row = await conn.fetchrow("""
                            UPDATE bar_files 
                            SET current_views = current_views + 1,
                                last_accessed_at = NOW()
                            WHERE token = $1 AND destroyed = FALSE
                            RETURNING current_views, max_views
                        """, token)
                        
                        if not row:
                            return False, 0, False, False
                        
                        current_views = row['current_views']
                        max_views = row['max_views']
                else:
                    async with aiosqlite.connect(self.db_path) as db:
                        await db.execute("""
                            UPDATE bar_files 
                            SET current_views = current_views + 1,
                                last_accessed_at = ?
                            WHERE token = ? AND destroyed = 0
                        """, (datetime.now(timezone.utc).isoformat(), token))
                        await db.commit()
                        
                        async with db.execute(
                            "SELECT current_views, max_views FROM bar_files WHERE token = ?",
                            (token,)
                        ) as cursor:
                            row = await cursor.fetchone()
                            if not row:
                                return False, 0, False, False
                            current_views, max_views = row
            else:
                # Don't increment, just get current counts
                file_record = await self.get_file_record(token)
                if not file_record:
                    return False, 0, False, False
                current_views = file_record['current_views']
                max_views = file_record['max_views']
            
            views_remaining = max(0, max_views - current_views)
            should_destroy = current_views >= max_views
            
            # Mark as destroyed if limit reached
            if should_destroy and is_new_view:
                await self.mark_as_destroyed(token)
            
            return True, views_remaining, should_destroy, is_new_view
            
        except Exception as e:
            print(f"❌ Failed to increment view count: {e}")
            return False, 0, False, False

    
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
                    return [dict(row) for row in rows]
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
                        return [dict(row) for row in rows]
            
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
                    return [dict(row) for row in rows]
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    db.row_factory = aiosqlite.Row
                    async with db.execute("""
                        SELECT * FROM bar_files 
                        WHERE current_views >= max_views
                        AND destroyed = 0
                    """) as cursor:
                        rows = await cursor.fetchall()
                        return [dict(row) for row in rows]
            
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
                        "SELECT analytics_key FROM bar_files WHERE token = $1",
                        token,
                    )
                    if not key_row:
                        return None
                    if not _verify_analytics_key(key_row["analytics_key"], analytics_key):
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
                        "SELECT analytics_key FROM bar_files WHERE token = ?",
                        (token,),
                    ) as cursor:
                        key_row = await cursor.fetchone()
                    if not key_row:
                        return None
                    if not _verify_analytics_key(dict(key_row).get("analytics_key"), analytics_key):
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

            # Parse metadata if it's a JSON string (SQLite stores it as text)
            if isinstance(file_info.get("metadata"), str):
                file_info["metadata"] = json.loads(file_info["metadata"])

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

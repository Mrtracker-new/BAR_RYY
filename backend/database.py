"""
Database module for BAR Web - Persistent file metadata tracking

This solves the Railway ephemeral filesystem problem by storing metadata
in a database instead of in the .bar files themselves.

Supports:
- SQLite for local development
- PostgreSQL for Railway production (persistent)
"""
import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import aiosqlite
from contextlib import asynccontextmanager

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///bar_files.db")
IS_POSTGRES = DATABASE_URL.startswith("postgresql://")

# For Railway PostgreSQL, we'll need asyncpg
if IS_POSTGRES:
    try:
        import asyncpg
        HAS_POSTGRES = True
    except ImportError:
        HAS_POSTGRES = False
        print("⚠️ asyncpg not installed - PostgreSQL support disabled")
else:
    HAS_POSTGRES = False


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
                    destroyed BOOLEAN DEFAULT 0
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
            
            await db.commit()
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
                        destroyed BOOLEAN DEFAULT FALSE
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
        metadata: Dict[str, Any]
    ) -> bool:
        """Create a new file record in the database"""
        try:
            max_views = metadata.get("max_views", 1)
            expires_at = metadata.get("expires_at")
            created_at = metadata.get("created_at", datetime.now(timezone.utc).isoformat())
            
            if self.is_postgres:
                # Convert ISO strings to timezone-aware datetime objects for PostgreSQL
                if expires_at:
                    if isinstance(expires_at, str):
                        # Handle both Z and +00:00 formats, ensure timezone-aware
                        expires_str = expires_at.replace('Z', '+00:00')
                        expires_at_dt = datetime.fromisoformat(expires_str)
                        # Ensure it's timezone-aware
                        if expires_at_dt.tzinfo is None:
                            expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
                    else:
                        expires_at_dt = expires_at
                        if expires_at_dt.tzinfo is None:
                            expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
                else:
                    expires_at_dt = None
                
                if isinstance(created_at, str):
                    # Handle both Z and +00:00 formats, ensure timezone-aware
                    created_str = created_at.replace('Z', '+00:00')
                    created_at_dt = datetime.fromisoformat(created_str)
                    # Ensure it's timezone-aware
                    if created_at_dt.tzinfo is None:
                        created_at_dt = created_at_dt.replace(tzinfo=timezone.utc)
                else:
                    created_at_dt = created_at
                    if created_at_dt.tzinfo is None:
                        created_at_dt = created_at_dt.replace(tzinfo=timezone.utc)
                
                async with self.pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO bar_files 
                        (token, filename, bar_filename, file_path, metadata, 
                         current_views, max_views, expires_at, created_at)
                        VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8)
                    """, token, filename, bar_filename, file_path, 
                       json.dumps(metadata), max_views, expires_at_dt, created_at_dt)
            else:
                async with aiosqlite.connect(self.db_path) as db:
                    await db.execute("""
                        INSERT INTO bar_files 
                        (token, filename, bar_filename, file_path, metadata, 
                         current_views, max_views, expires_at, created_at)
                        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
                    """, (token, filename, bar_filename, file_path, 
                          json.dumps(metadata), max_views, expires_at, created_at))
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
    
    async def increment_view_count(self, token: str) -> tuple[bool, int, bool]:
        """
        Increment view count for a file
        Returns: (success, views_remaining, should_destroy)
        """
        try:
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
                        return False, 0, False
                    
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
                            return False, 0, False
                        current_views, max_views = row
            
            views_remaining = max(0, max_views - current_views)
            should_destroy = current_views >= max_views
            
            # Mark as destroyed if limit reached
            if should_destroy:
                await self.mark_as_destroyed(token)
            
            return True, views_remaining, should_destroy
            
        except Exception as e:
            print(f"❌ Failed to increment view count: {e}")
            return False, 0, False
    
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
            cutoff_iso = cutoff_dt.isoformat()
            
            if self.is_postgres:
                async with self.pool.acquire() as conn:
                    result = await conn.execute("""
                        DELETE FROM bar_files 
                        WHERE destroyed = TRUE 
                        AND created_at < $1
                    """, cutoff_dt)
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

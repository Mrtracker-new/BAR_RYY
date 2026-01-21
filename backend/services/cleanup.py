"""
Background cleanup task for BAR Web API
Removes:
- Old temporary uploads (>1 hour)
- Expired server-side .bar files
"""
import os
import time
from datetime import datetime, timedelta
import asyncio
import json
from utils import crypto_utils
from core import database

# Directories
UPLOAD_DIR = "uploads"
GENERATED_DIR = "generated"

# Cleanup intervals
UPLOAD_CLEANUP_AGE = 3600  # 1 hour in seconds
CLEANUP_INTERVAL = 600  # Run every 10 minutes


def cleanup_old_uploads():
    """Remove temporary uploads older than 1 hour"""
    if not os.path.exists(UPLOAD_DIR):
        return
    
    now = time.time()
    cutoff = now - UPLOAD_CLEANUP_AGE
    cleaned = 0
    
    try:
        for filename in os.listdir(UPLOAD_DIR):
            filepath = os.path.join(UPLOAD_DIR, filename)
            
            # Check if file is older than cutoff
            if os.path.isfile(filepath):
                file_age = os.path.getmtime(filepath)
                if file_age < cutoff:
                    try:
                        os.remove(filepath)
                        cleaned += 1
                        print(f"🧹 Cleaned old upload: {filename}")
                    except Exception as e:
                        print(f"⚠️ Failed to clean {filename}: {e}")
    except Exception as e:
        print(f"⚠️ Cleanup error: {e}")
    
    if cleaned > 0:
        print(f"✅ Cleaned {cleaned} old upload(s)")


async def cleanup_expired_bar_files():
    """Remove expired server-side .bar files using database queries"""
    if not os.path.exists(GENERATED_DIR):
        return
    
    cleaned = 0
    
    try:
        # Get expired files from database
        expired_files = await database.db.get_expired_files()
        
        for file_record in expired_files:
            file_path = file_record['file_path']
            token = file_record['token']
            
            try:
                if os.path.exists(file_path):
                    crypto_utils.secure_delete_file(file_path)
                    print(f"🧹 Deleted expired file: {file_record['filename']} (token: {token[:8]})")
                
                # Mark as destroyed in database
                await database.db.mark_as_destroyed(token)
                cleaned += 1
                
            except Exception as e:
                print(f"⚠️ Failed to clean expired file {token[:8]}: {e}")
        
        # Get exhausted files (reached max views)
        exhausted_files = await database.db.get_exhausted_files()
        
        for file_record in exhausted_files:
            file_path = file_record['file_path']
            token = file_record['token']
            
            try:
                if os.path.exists(file_path):
                    crypto_utils.secure_delete_file(file_path)
                    print(f"🧹 Deleted exhausted file: {file_record['filename']} (token: {token[:8]})")
                
                # Mark as destroyed in database
                await database.db.mark_as_destroyed(token)
                cleaned += 1
                
            except Exception as e:
                print(f"⚠️ Failed to clean exhausted file {token[:8]}: {e}")
        
        # Clean up old database records (destroyed files older than 7 days)
        old_records_cleaned = await database.db.cleanup_old_records(days=7)
        if old_records_cleaned > 0:
            print(f"🧹 Cleaned {old_records_cleaned} old database record(s)")
    
    except Exception as e:
        print(f"⚠️ Database cleanup error: {e}")
    
    if cleaned > 0:
        print(f"✅ Cleaned {cleaned} expired/exhausted .bar file(s)")


async def run_cleanup_loop():
    """Main cleanup loop - runs every 10 minutes"""
    print(f"🧹 Cleanup task started (runs every {CLEANUP_INTERVAL//60} minutes)")
    
    while True:
        try:
            print(f"\n🕐 Running cleanup... {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            
            # Clean old uploads
            cleanup_old_uploads()
            
            # Clean expired BAR files using database
            await cleanup_expired_bar_files()
            
            print(f"✓ Cleanup complete\n")
            
        except Exception as e:
            print(f"❌ Cleanup task error: {e}")
        
        # Wait for next interval
        await asyncio.sleep(CLEANUP_INTERVAL)


def start_cleanup_task():
    """Start the cleanup task in the background"""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    # Create task
    task = loop.create_task(run_cleanup_loop())
    return task

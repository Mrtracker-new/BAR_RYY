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
import crypto_utils

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


def cleanup_expired_bar_files():
    """Remove expired server-side .bar files"""
    if not os.path.exists(GENERATED_DIR):
        return
    
    now = datetime.now()
    cleaned = 0
    
    try:
        for filename in os.listdir(GENERATED_DIR):
            if not filename.endswith('.bar'):
                continue
            
            filepath = os.path.join(GENERATED_DIR, filename)
            
            try:
                # Read BAR file metadata to check expiry
                with open(filepath, 'rb') as f:
                    bar_data = f.read()
                
                # Unpack to get metadata
                encrypted_data, metadata, key = crypto_utils.unpack_bar_file(bar_data)
                
                # Check if expired
                expires_at = metadata.get('expires_at')
                if expires_at:
                    expiry_time = datetime.fromisoformat(expires_at)
                    if now > expiry_time:
                        # File expired - delete it
                        crypto_utils.secure_delete_file(filepath)
                        cleaned += 1
                        print(f"🧹 Deleted expired file: {filename}")
                
                # Also check if max views reached (shouldn't happen but safety check)
                storage_mode = metadata.get('storage_mode', 'client')
                if storage_mode == 'server':
                    max_views = metadata.get('max_views', 0)
                    current_views = metadata.get('current_views', 0)
                    if max_views > 0 and current_views >= max_views:
                        crypto_utils.secure_delete_file(filepath)
                        cleaned += 1
                        print(f"🧹 Deleted exhausted file: {filename}")
                        
            except Exception as e:
                # If we can't read the file, it might be corrupted
                # Check if it's very old (>7 days) and delete
                file_age = os.path.getmtime(filepath)
                age_days = (time.time() - file_age) / 86400
                if age_days > 7:
                    try:
                        os.remove(filepath)
                        cleaned += 1
                        print(f"🧹 Deleted corrupted/old file: {filename}")
                    except:
                        pass
    
    except Exception as e:
        print(f"⚠️ BAR cleanup error: {e}")
    
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
            
            # Clean expired BAR files
            cleanup_expired_bar_files()
            
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

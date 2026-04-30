#!/usr/bin/env python3
"""
BAR File Decryptor - Command Line Tool
Decrypt .bar files and extract the original file.

Usage:
    python decrypt_bar.py <file.bar> [password] [output_dir]

This tool uses the authoritative access validators from the storage layer:
  - client_storage.validate_client_access  for storage_mode='client' files
  - server_storage.validate_server_access  for storage_mode='server' files

The routing is determined by the 'storage_mode' field embedded in the BAR
file's plaintext metadata — the same field written by create_client_metadata()
and create_server_metadata() at seal time.
"""

import sys
import os

# ---------------------------------------------------------------------------
# sys.path wiring
# ---------------------------------------------------------------------------
# This CLI lives inside `utils/`.  The storage package lives one level up at
# `backend/storage/`.  When the script is run directly (e.g.
# `python utils/decrypt_bar.py`) Python adds `utils/` to sys.path but not the
# `backend/` root, so `from storage import ...` would fail with ModuleNotFoundError.
#
# We detect this situation and insert the backend root so both the direct-run
# and the installed-package invocation paths work without any wrapper script.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_ROOT = os.path.dirname(_SCRIPT_DIR)  # parent of utils/
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)
# utils/ itself must also be on the path (crypto_utils lives there).
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

import crypto_utils
from storage import client_storage
from storage import server_storage


def decrypt_bar_file(bar_file_path, password=None, output_dir=None):
    """Decrypt a .bar file and extract the original file"""
    
    if not os.path.exists(bar_file_path):
        print(f"❌ Error: File not found: {bar_file_path}")
        return False
    
    if not bar_file_path.endswith('.bar'):
        print(f"❌ Error: Not a .bar file: {bar_file_path}")
        return False
    
    print(f"🔓 Decrypting: {bar_file_path}")
    print("=" * 50)
    
    try:
        # Read BAR file
        with open(bar_file_path, 'rb') as f:
            bar_data = f.read()
        
        # Unpack BAR file with password for password-derived encryption
        encrypted_data, metadata, key, _salt = crypto_utils.unpack_bar_file(bar_data, password=password)
        
        # Display metadata
        print(f"📄 Original Filename: {metadata['filename']}")
        print(f"📅 Created: {metadata['created_at']}")
        if metadata.get('expires_at'):
            print(f"⏰ Expires: {metadata['expires_at']}")
        print(f"👁️  Max Views: {metadata.get('max_views', 'Unlimited')}")
        print(f"👁️  Current Views: {metadata.get('current_views', 0)}")
        print(f"🔐 Password Protected: {'Yes' if metadata.get('password_protected') else 'No'}")
        print("=" * 50)
        
        # Validate access using the authoritative storage-layer validator.
        #
        # The storage_mode field is stamped into every BAR file's plaintext
        # metadata by create_client_metadata() / create_server_metadata() at
        # seal time.  It is the single source of truth for which rule-set
        # governs this file:
        #
        #   'client' → validate_client_access  (expiry + password presence)
        #   'server' → validate_server_access  (expiry + view limits + password)
        #
        # Defaulting to 'server' for unrecognised / missing values ensures that
        # the stricter rule-set applies rather than silently downgrading access
        # control on legacy or tampered files.
        storage_mode = metadata.get("storage_mode", "server")
        if storage_mode == "client":
            is_valid, errors = client_storage.validate_client_access(metadata, password)
        else:
            is_valid, errors = server_storage.validate_server_access(metadata, password)

        if not is_valid:
            print("❌ Cannot decrypt file:")
            for error in errors:
                print(f"   - {error}")
            return False
        
        # Decrypt file
        print("🔑 Decrypting file data...")
        decrypted_data = crypto_utils.decrypt_file(encrypted_data, key)
        
        # Verify integrity
        print("🔍 Verifying file integrity...")
        file_hash = crypto_utils.calculate_file_hash(decrypted_data)
        if file_hash != metadata.get('file_hash'):
            print("⚠️  WARNING: File integrity check failed - possible tampering!")
            response = input("Continue anyway? (y/N): ")
            if response.lower() != 'y':
                return False
        else:
            print("✅ File integrity verified!")
        
        # Determine output path
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, metadata['filename'])
        else:
            output_path = metadata['filename']
        
        # Save decrypted file
        with open(output_path, 'wb') as f:
            f.write(decrypted_data)
        
        print(f"✅ File decrypted successfully!")
        print(f"💾 Saved to: {output_path}")
        print(f"📊 Size: {len(decrypted_data)} bytes")
        
        # Update view count (in real implementation)
        views_remaining = metadata.get('max_views', 0) - metadata.get('current_views', 0) - 1
        if metadata.get('max_views', 0) > 0:
            print(f"⚠️  Views remaining: {max(0, views_remaining)}")
            if views_remaining <= 0:
                print("🔥 This was the last view - file should be destroyed!")
        
        return True
        
    except Exception as e:
        print(f"❌ Decryption failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("BAR File Decryptor")
        print("=" * 50)
        print("Usage:")
        print(f"  python {sys.argv[0]} <file.bar> [password] [output_dir]")
        print()
        print("Examples:")
        print(f"  python {sys.argv[0]} document.bar")
        print(f"  python {sys.argv[0]} document.bar mypassword")
        print(f"  python {sys.argv[0]} document.bar mypassword ./output")
        print()
        sys.exit(1)
    
    bar_file = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else None
    output_dir = sys.argv[3] if len(sys.argv) > 3 else None
    
    success = decrypt_bar_file(bar_file, password, output_dir)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

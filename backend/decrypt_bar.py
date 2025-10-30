#!/usr/bin/env python3
"""
BAR File Decryptor - Command Line Tool
Decrypt .bar files and extract the original file
"""

import sys
import os
import json
import crypto_utils


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
        encrypted_data, metadata, key = crypto_utils.unpack_bar_file(bar_data, password=password)
        
        # Display metadata
        print(f"📄 Original Filename: {metadata['filename']}")
        print(f"📅 Created: {metadata['created_at']}")
        if metadata.get('expires_at'):
            print(f"⏰ Expires: {metadata['expires_at']}")
        print(f"👁️  Max Views: {metadata.get('max_views', 'Unlimited')}")
        print(f"👁️  Current Views: {metadata.get('current_views', 0)}")
        print(f"🔐 Password Protected: {'Yes' if metadata.get('password_protected') else 'No'}")
        print("=" * 50)
        
        # Validate access
        is_valid, errors = crypto_utils.validate_bar_access(metadata, password)
        
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

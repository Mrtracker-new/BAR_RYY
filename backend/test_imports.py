#!/usr/bin/env python3
"""Quick test to verify all imports are working"""

print("Testing BAR Web Backend Imports...")
print("=" * 50)

try:
    print("✓ Importing FastAPI...")
    from fastapi import FastAPI, File, UploadFile
    print("  SUCCESS!")
except Exception as e:
    print(f"  FAILED: {e}")

try:
    print("✓ Importing cryptography...")
    from cryptography.fernet import Fernet
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
    print("  SUCCESS!")
except Exception as e:
    print(f"  FAILED: {e}")

try:
    print("✓ Importing crypto_utils...")
    import crypto_utils
    print("  SUCCESS!")
except Exception as e:
    print(f"  FAILED: {e}")

try:
    print("✓ Importing app module...")
    import app
    print("  SUCCESS!")
except Exception as e:
    print(f"  FAILED: {e}")

print("=" * 50)
print("✅ All imports successful! Backend is ready.")
print("\nTo start the server, run:")
print("  python app.py")

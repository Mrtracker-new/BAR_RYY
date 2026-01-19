"""
Environment Variable Validation
Validates required environment variables on startup to prevent runtime failures
"""
import os
import sys
from typing import List, Optional


# Define required secrets based on features
REQUIRED_SECRETS = {
    "2FA": ["BREVO_API_KEY", "FROM_EMAIL"],
}

# Optional but recommended environment variables
RECOMMENDED_VARS = [
    "FRONTEND_URL",
    "FROM_NAME",
]


def validate_env() -> tuple[bool, List[str]]:
    """
    Validate that required environment variables are set
    Returns: (is_valid, missing_vars)
    """
    missing_vars = []
    warnings = []
    
    # Check if 2FA is being used (only validate secrets if 2FA is required)
    # This allows the app to run without email in development
    require_2fa = os.getenv("REQUIRE_2FA", "").lower() == "true"
    
    if require_2fa:
        print("🔒 2FA is enabled - validating email service secrets...")
        for secret in REQUIRED_SECRETS["2FA"]:
            if not os.getenv(secret):
                missing_vars.append(secret)
    else:
        print("ℹ️  2FA is disabled - skipping email service validation")
        print("   Set REQUIRE_2FA=true to enable 2FA validation")
    
    # Check recommended variables (warnings only)
    for var in RECOMMENDED_VARS:
        if not os.getenv(var):
            warnings.append(var)
    
    # Display warnings for recommended vars
    if warnings:
        print(f"⚠️  Recommended environment variables not set: {', '.join(warnings)}")
        print("   The application will use defaults, but setting these is recommended for production")
    
    return len(missing_vars) == 0, missing_vars


def validate_and_exit_on_error():
    """
    Validate environment variables and exit if critical ones are missing.
    Only enforces validation if REQUIRE_2FA is enabled.
    """
    print("\n" + "="*60)
    print("🔍 Environment Variable Validation")
    print("="*60)
    
    is_valid, missing = validate_env()
    
    if not is_valid:
        print("\n❌ CRITICAL: Missing required environment variables!")
        print("="*60)
        print("\nThe following secrets are required when 2FA is enabled:")
        for var in missing:
            print(f"  ❌ {var}")
        
        print("\n💡 To fix this:")
        print("  1. Create a .env file in the backend directory")
        print("  2. Add the missing variables with appropriate values")
        print("  3. See .env.example for reference")
        print("\nAlternatively, disable 2FA by removing or setting REQUIRE_2FA=false")
        print("="*60)
        
        # Exit with error code if in production or if REQUIRE_2FA is explicitly set
        if os.getenv("IS_PRODUCTION") or os.getenv("REQUIRE_2FA"):
            sys.exit(1)
        else:
            print("\n⚠️  Running in development mode - continuing with warnings")
    else:
        print("\n✅ All required environment variables are set")
    
    print("="*60 + "\n")


def get_validation_status() -> dict:
    """
    Get current validation status as a dictionary.
    Useful for health check endpoints.
    """
    is_valid, missing = validate_env()
    
    return {
        "valid": is_valid,
        "missing_secrets": missing,
        "2fa_enabled": os.getenv("REQUIRE_2FA", "").lower() == "true",
        "production_mode": os.getenv("IS_PRODUCTION", "").lower() == "true",
    }


if __name__ == "__main__":
    # Allow running this module directly to test validation
    validate_and_exit_on_error()

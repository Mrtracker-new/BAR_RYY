"""
Environment Variable Validation
Validates required environment variables on startup to prevent runtime failures
"""
import os
import sys
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


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
        logger.info("2FA is enabled - validating email service secrets...")
        for secret in REQUIRED_SECRETS["2FA"]:
            if not os.getenv(secret):
                missing_vars.append(secret)
    else:
        logger.info("2FA is disabled - skipping email service validation")
    
    # Check recommended variables (warnings only)
    for var in RECOMMENDED_VARS:
        if not os.getenv(var):
            warnings.append(var)
    
    # Display warnings for recommended vars
    if warnings:
        logger.warning(
            "Recommended environment variables not set: %s (app will use defaults)",
            ", ".join(warnings)
        )
    
    return len(missing_vars) == 0, missing_vars


def validate_and_exit_on_error():
    """
    Validate environment variables and exit if critical ones are missing.
    Only enforces validation if REQUIRE_2FA is enabled.
    """
    logger.info("Validating environment configuration")
    
    is_valid, missing = validate_env()
    
    if not is_valid:
        logger.error(
            "CRITICAL: Missing required environment variables when 2FA is enabled: %s",
            ", ".join(missing)
        )
        
        # Exit with error code if in production or if REQUIRE_2FA is explicitly set
        if os.getenv("IS_PRODUCTION") or os.getenv("REQUIRE_2FA"):
            sys.exit(1)
        else:
            logger.warning("Running in development mode - continuing with warnings")
    else:
        logger.info("All required environment variables are set")


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

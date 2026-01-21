"""Dependency injection for FastAPI routes."""
from typing import Generator
from core.config import settings, Settings
from services.file_service import get_file_service, FileService
from services.encryption_service import get_encryption_service, EncryptionService
from services import otp_service
from core import database


def get_settings() -> Settings:
    """Get application settings."""
    return settings


def get_file_service_dep() -> FileService:
    """Get file service dependency."""
    return get_file_service()


def get_encryption_service_dep() -> EncryptionService:
    """Get encryption service dependency."""
    return get_encryption_service()


def get_otp_service_dep():
    """Get OTP service dependency."""
    return otp_service.get_otp_service()


async def get_database():
    """Get database connection."""
    # Database is already initialized in app startup
    return database.db

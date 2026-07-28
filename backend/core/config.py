"""Application configuration management."""
import os
from typing import List
try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic.v1 import BaseSettings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


# Base directory (backend root)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def resolve_sqlite_db_path(database_url: str, base_dir: str = BASE_DIR) -> str:
    """
    Derive an absolute filesystem path for a SQLite database URL.

    Anchors relative paths (e.g. 'sqlite:///bar_files.db' or 'sqlite:///./bar_files.db')
    against base_dir (default: backend/ root directory) to ensure deterministic
    on-disk database locations regardless of launch working directory.
    """
    if database_url.startswith("sqlite:///"):
        raw_path = database_url[10:]
    elif database_url.startswith("sqlite://"):
        raw_path = database_url[9:]
    else:
        raw_path = "bar_files.db"

    if os.path.isabs(raw_path):
        return os.path.abspath(raw_path)
    return os.path.abspath(os.path.join(base_dir, raw_path))


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    app_name: str = "BAR Web API"
    app_version: str = "1.0"
    debug: bool = False
    is_production: bool = False
    
    # Directories
    upload_dir: str = "uploads"
    generated_dir: str = "generated"
    
    # CORS
    frontend_url: str = os.getenv("FRONTEND_URL", "")
    
    # File limits
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    
    # Email (for OTP) - Brevo/Sendinblue
    smtp_server: str = os.getenv("SMTP_SERVER", "")
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    sender_email: str = os.getenv("SENDER_EMAIL", "")
    brevo_api_key: str = os.getenv("BREVO_API_KEY", "")
    from_email: str = os.getenv("FROM_EMAIL", "")
    from_name: str = os.getenv("FROM_NAME", "BAR Web")
    
    # Database
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./bar_files.db")

    @property
    def sqlite_db_path(self) -> str:
        """Return absolute filesystem path for the SQLite database."""
        return resolve_sqlite_db_path(self.database_url)
    
    # 2FA
    require_2fa: bool = os.getenv("REQUIRE_2FA", "false").lower() == "true"

    # Geolocation
    # Set ENABLE_GEOLOCATION=false to fully disable IP geolocation lookups
    # (saves external API quota on low-budget or self-hosted deployments).
    enable_geolocation: bool = os.getenv("ENABLE_GEOLOCATION", "true").lower() == "true"
    
    @property
    def allowed_origins_dev(self) -> List[str]:
        """
        Full origin list including localhost — used in local development only.
        Never use this list in production; localhost origins bypass CSRF and
        CORS Same-Origin protections when the browser and attacker server run
        on the same machine.
        """
        origins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://bar-rnr.vercel.app",
        ]
        if self.frontend_url:
            origins.append(self.frontend_url)
            origins.append(self.frontend_url.rstrip("/"))
        return list(dict.fromkeys(origins))  # deduplicate, preserve order

    @property
    def allowed_origins_production(self) -> List[str]:
        """
        Strict origin list for production — localhost is intentionally absent.

        Cookie / CORS policy reminder
        ------------------------------
        If cookies are ever added:
            SameSite=Strict; Secure; HttpOnly
        on every Set-Cookie response, and only set allow_credentials=True in
        CORSMiddleware if cross-origin cookie sharing is a hard requirement.
        """
        origins = ["https://bar-rnr.vercel.app"]
        if self.frontend_url:
            origins.append(self.frontend_url)
            origins.append(self.frontend_url.rstrip("/"))
        return list(dict.fromkeys(origins))  # deduplicate, preserve order

    @property
    def allowed_origins(self) -> List[str]:
        """
        Active CORS origin list — delegates to the correct property based on
        the IS_PRODUCTION environment variable so callers always get the right
        list without having to make the choice themselves.
        """
        return (
            self.allowed_origins_production
            if self.is_production
            else self.allowed_origins_dev
        )
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields from .env


# Global settings instance
settings = Settings()

# Ensure directories exist
os.makedirs(settings.upload_dir, exist_ok=True)
os.makedirs(settings.generated_dir, exist_ok=True)

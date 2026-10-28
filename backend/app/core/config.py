import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Projeto Base"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    DB_POOL_SIZE: int = int(os.getenv("DB_POOL_SIZE", "20"))
    DB_MAX_OVERFLOW: int = int(os.getenv("DB_MAX_OVERFLOW", "30"))

    SECRET_KEY: str = os.getenv("SECRET_KEY", "supersecret-jwt-key-projeto-base-981273491")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Pepper for password hashing (kept secret on the server)
    SECURITY_PASSWORD_PEPPER: str = os.getenv("SECURITY_PASSWORD_PEPPER", "custom-pepper-salt-projeto-base-secure-key-2026")

    # Super Admin credentials from ENV
    SUPERADMIN_EMAIL: str = os.getenv("SUPERADMIN_EMAIL", "aryarajmarketing@gmail.com")
    SUPERADMIN_PASSWORD: str = os.getenv("SUPERADMIN_PASSWORD", "SuperAdmin@2026!")
    SUPERADMIN_NAME: str = os.getenv("SUPERADMIN_NAME", "Super Admin")

    # Brevo Email API
    BREVO_API_KEY: str = os.getenv("BREVO_API_KEY", "")
    BREVO_SENDER_EMAIL: str = os.getenv("BREVO_SENDER_EMAIL", "")
    BREVO_SENDER_NAME: str = os.getenv("BREVO_SENDER_NAME", "Projeto Base")

    # Backblaze B2 / AWS S3 Configs para Backup Automático (Suporta tanto B2_* quanto BACKBLAZE_*)
    B2_ENDPOINT_URL: str = os.getenv("BACKBLAZE_ENDPOINT_URL") or os.getenv("B2_ENDPOINT_URL", "")
    B2_KEY_ID: str = os.getenv("BACKBLAZE_KEY_ID") or os.getenv("B2_KEY_ID", "")
    B2_APPLICATION_KEY: str = os.getenv("BACKBLAZE_APPLICATION_KEY") or os.getenv("B2_APPLICATION_KEY", "")
    B2_BUCKET_NAME: str = os.getenv("BACKBLAZE_BUCKET_NAME") or os.getenv("B2_BUCKET_NAME", "")
    BACKBLAZE_CDN_URL: str = os.getenv("BACKBLAZE_CDN_URL", "")
    B2_FOLDER: str = os.getenv("B2_FOLDER", "projetobase/backups/")
    B2_RETENTION_MAX: int = int(os.getenv("B2_RETENTION_MAX", "30"))

    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()

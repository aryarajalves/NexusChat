import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Nexus Chat" if not os.getenv("PROJECT_NAME") or "Projeto Base" in os.getenv("PROJECT_NAME") else os.getenv("PROJECT_NAME")
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
    BREVO_SENDER_NAME: str = os.getenv("BREVO_SENDER_NAME", "NexusChat")

    # Backblaze B2 / AWS S3 Configs para Backup e Armazenamento de Mídias
    B2_ENDPOINT_URL: str = os.getenv("BACKBLAZE_ENDPOINT_URL") or os.getenv("B2_ENDPOINT_URL", "")
    B2_KEY_ID: str = os.getenv("BACKBLAZE_KEY_ID") or os.getenv("B2_KEY_ID", "")
    B2_APPLICATION_KEY: str = os.getenv("BACKBLAZE_APPLICATION_KEY") or os.getenv("B2_APPLICATION_KEY", "")
    B2_BUCKET_NAME: str = os.getenv("BACKBLAZE_BUCKET_NAME") or os.getenv("B2_BUCKET_NAME", "")
    BACKBLAZE_CDN_URL: str = os.getenv("BACKBLAZE_CDN_URL", "")
    B2_FOLDER: str = os.getenv("B2_FOLDER", "projetobase/backups/")
    B2_MEDIA_FOLDER: str = os.getenv("B2_MEDIA_FOLDER", "discord_media/")
    B2_RETENTION_MAX: int = int(os.getenv("B2_RETENTION_MAX", "30"))

    # Redis para Pub/Sub de WebSockets e Cache Distribuído
    REDIS_URL: str = os.getenv("REDIS_URL", "")

    # LiveKit SFU (Serviço de Voz & Vídeo em Alta Escala)
    LIVEKIT_URL: str = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
    LIVEKIT_API_KEY: str = os.getenv("LIVEKIT_API_KEY", "devkey")
    LIVEKIT_API_SECRET: str = os.getenv("LIVEKIT_API_SECRET", "secret_livekit_key_2026_discord_clone")

    # Configurações de Segurança: CORS e Rate Limiting
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3005,http://localhost:5173,http://localhost:3000,http://127.0.0.1:3005,http://127.0.0.1:5173,http://127.0.0.1:3000"
    )
    RATELIMIT_ENABLED: bool = os.getenv("RATELIMIT_ENABLED", "True").lower() in ("true", "1", "yes")

    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()
if not settings.PROJECT_NAME or "Projeto Base" in settings.PROJECT_NAME:
    settings.PROJECT_NAME = "Nexus Chat"

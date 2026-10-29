from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.core.logger import logger
from app.core.security_headers import SecurityHeadersMiddleware
from app.models.user import User, Invite
from app.models.backup import BackupSchedule, BackupHistory
from app.models.infrastructure import SystemAlertConfig, SystemPeakMetric, SystemConnectionHistory
from app.models.discord import Server, Channel, ServerMember, Message, ServerInvite
from app.api.v1.api import api_router
from app.services.scheduler import setup_scheduler, scheduler
from app.services.socket_manager import socket_manager

def init_superadmin():
    db: Session = SessionLocal()
    try:
        superadmin = db.query(User).filter(User.role == "superadmin").first()
        if not superadmin:
            # Check if email is used or create initial superadmin
            existing_email = db.query(User).filter(User.email == settings.SUPERADMIN_EMAIL).first()
            if not existing_email:
                superadmin = User(
                    email=settings.SUPERADMIN_EMAIL,
                    name=settings.SUPERADMIN_NAME,
                    hashed_password=get_password_hash(settings.SUPERADMIN_PASSWORD),
                    role="superadmin",
                    is_active=True,
                    max_servers=-1
                )
                db.add(superadmin)
                db.commit()
            else:
                existing_email.role = "superadmin"
                existing_email.hashed_password = get_password_hash(settings.SUPERADMIN_PASSWORD)
                existing_email.name = settings.SUPERADMIN_NAME
                existing_email.max_servers = -1
                db.commit()
        else:
            # Superadmin exists: sync email, name and password from env if user updated .env
            superadmin.email = settings.SUPERADMIN_EMAIL
            superadmin.name = settings.SUPERADMIN_NAME
            superadmin.hashed_password = get_password_hash(settings.SUPERADMIN_PASSWORD)
            superadmin.is_active = True
            superadmin.max_servers = -1
            db.commit()
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables
    Base.metadata.create_all(bind=engine)
    # Ensure columns exist on already created tables
    with engine.connect() as conn:
        from sqlalchemy import text
        try:
            conn.execute(text("ALTER TABLE invites ADD COLUMN IF NOT EXISTS used_by_email VARCHAR;"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS max_servers INTEGER DEFAULT 100;"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE invites ADD COLUMN IF NOT EXISTS max_servers INTEGER DEFAULT 100;"))
            conn.commit()
        except Exception:
            pass

    # Seed initial superadmin from env
    init_superadmin()
    # Inicializa agendador de backup automático em background
    setup_scheduler()
    # Inicializa barramento de WebSockets via Redis Pub/Sub (se configurado)
    await socket_manager.init_redis()
    yield
    # Encerra conexão do Redis Pub/Sub
    await socket_manager.close_redis()
    # Finaliza scheduler se estiver rodando
    if scheduler.running:
        scheduler.shutdown()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Erro inesperado em {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Tente novamente mais tarde."}
    )

# Middleware defensivo de Security Headers (X-Content-Type-Options, X-Frame-Options, etc.)
app.add_middleware(SecurityHeadersMiddleware)

# Configuração de CORS com origens explícitas e suporte a credenciais seguras
cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins and cors_origins != ["*"] else ["*"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Retry-After"]
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME}

@app.get("/")
def root():
    return {"message": f"Bem-vindo ao {settings.PROJECT_NAME}"}

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
    # Aguarda o banco de dados estar 100% pronto antes de criar tabelas e migrações
    import time
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError

    max_retries = 15
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as test_conn:
                test_conn.execute(text("SELECT 1"))
            logger.info("Conexão com o banco de dados verificada e ativa.")
            break
        except OperationalError as e:
            if attempt == max_retries:
                logger.error(f"Falha crítica ao conectar no banco de dados após {max_retries} tentativas: {e}")
                raise
            logger.warning(f"Banco de dados ainda iniciando (tentativa {attempt}/{max_retries}). Aguardando 2s...")
            time.sleep(2)

    # Create tables
    Base.metadata.create_all(bind=engine)
    # Ensure columns exist on already created tables
    with engine.connect() as conn:
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
        # Sistema de Boas-Vindas por Servidor
        try:
            conn.execute(text("ALTER TABLE servers ADD COLUMN IF NOT EXISTS welcome_enabled BOOLEAN NOT NULL DEFAULT FALSE;"))
            conn.commit()
        except Exception:
            pass
        try:
            if conn.dialect.name == "postgresql":
                conn.execute(text("ALTER TABLE servers ADD COLUMN IF NOT EXISTS welcome_channel_id INTEGER REFERENCES channels(id) ON DELETE SET NULL;"))
            else:
                conn.execute(text("ALTER TABLE servers ADD COLUMN IF NOT EXISTS welcome_channel_id INTEGER;"))
            conn.commit()
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE servers ADD COLUMN IF NOT EXISTS welcome_message VARCHAR(2000) DEFAULT 'Olá {user}, seja muito bem-vindo(a) ao servidor **{server}**! 🎉';"))
            conn.commit()
        except Exception:
            pass
        # Tópicos (Threads)
        try:
            if conn.dialect.name == "postgresql":
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS message_threads (
                        id SERIAL PRIMARY KEY,
                        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                        root_message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
                        creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        name VARCHAR(100) NOT NULL,
                        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
                        updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
                    );
                """))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS thread_messages (
                        id SERIAL PRIMARY KEY,
                        thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
                        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        content VARCHAR(2000) NOT NULL,
                        attachment_url VARCHAR(500),
                        attachment_type VARCHAR(50),
                        attachment_size INTEGER,
                        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
                        updated_at TIMESTAMP WITHOUT TIME ZONE
                    );
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_message_threads_channel_id ON message_threads (channel_id);"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id_id ON thread_messages (thread_id, id);"))
                conn.commit()
        except Exception:
            pass
        # Permissões de Palco (Stage Channels)
        try:
            conn.execute(text("ALTER TABLE server_roles ADD COLUMN IF NOT EXISTS can_moderate_stage BOOLEAN NOT NULL DEFAULT FALSE;"))
            conn.commit()
        except Exception:
            pass
        # Índices de ForeignKeys do Discord
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_servers_welcome_channel_id ON servers (welcome_channel_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages (reply_to_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_server_invites_created_by_id ON server_invites (created_by_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dm_messages_reply_to_id ON dm_messages (reply_to_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_server_emojis_user_id ON server_emojis (user_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_server_soundboard_sounds_user_id ON server_soundboard_sounds (user_id);"))
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

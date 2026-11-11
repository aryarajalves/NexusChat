from contextlib import contextmanager
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgresql+asyncpg://"):
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@contextmanager
def get_db_context():
    """
    Context manager sob demanda para abrir e fechar sessões de banco pontualmente.
    Em testes, respeita app.dependency_overrides[get_db].
    Em produção, utiliza SessionLocal() e devolve imediatamente a conexão ao pool ao sair do bloco with.
    """
    override = None
    try:
        from app.main import app
        override = app.dependency_overrides.get(get_db)
    except Exception:
        pass

    if override:
        gen = override()
        db = next(gen)
        try:
            yield db
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
            raise
        finally:
            try:
                next(gen)
            except Exception:
                pass
            try:
                db.close()
            except Exception:
                pass
    else:
        db = SessionLocal()
        try:
            yield db
        except Exception:
            try:
                db.rollback()
            except Exception:
                pass
            raise
        finally:
            db.close()

"""
Serviço de Execução de Backup e Restauração do Banco de Dados (PostgreSQL / SQLite).
Suporta geração de dumps compactados (.dump.gz), restauração e purga de retenção máxima.
"""
import gzip
import io
import os
import subprocess
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from urllib.parse import urlparse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.logger import logger
from app.core.database import SessionLocal
from app.models.backup import BackupHistory, BackupSchedule
from app.services.storage import upload_backup_file, download_backup_file, delete_backup_file

BRASILIA_TZ = ZoneInfo("America/Sao_Paulo")

def utc_now():
    return datetime.now(timezone.utc)

def brasilia_now():
    """Retorna data e hora atual no fuso de Brasília (America/Sao_Paulo)."""
    return datetime.now(BRASILIA_TZ)

def parse_db_url():
    """Extrai credenciais de conexão do DATABASE_URL."""
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        return {"driver": "sqlite", "path": url.replace("sqlite:///", "")}
    parsed = urlparse(url)
    return {
        "driver": "postgres",
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "host": parsed.hostname or "db",
        "port": str(parsed.port or 5432),
        "database": parsed.path.lstrip("/") or "projetobase",
    }

def generate_db_dump() -> bytes:
    """Executa o dump do banco de dados e retorna os bytes compactados com Gzip."""
    db_info = parse_db_url()
    
    if db_info["driver"] == "sqlite":
        # Dump para SQLite
        sqlite_file = db_info["path"]
        if not os.path.exists(sqlite_file):
            raw_content = b"-- Empty sqlite database dump\n"
        else:
            with open(sqlite_file, "rb") as f:
                raw_content = f.read()
        return gzip.compress(raw_content)

    # Dump para PostgreSQL via pg_dump
    env = os.environ.copy()
    env["PGPASSWORD"] = db_info["password"]
    cmd = [
        "pg_dump",
        "-h", db_info["host"],
        "-p", db_info["port"],
        "-U", db_info["user"],
        "-d", db_info["database"],
        "-F", "c", # Formato customizado binário do PostgreSQL
    ]
    try:
        proc = subprocess.run(
            cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
            timeout=15
        )
        # Compacta a saída do pg_dump com gzip (.dump.gz)
        compressed = gzip.compress(proc.stdout)
        return compressed
    except subprocess.CalledProcessError as e:
        err_msg = e.stderr.decode('utf-8', errors='ignore')
        logger.error(f"Erro ao executar pg_dump: {err_msg}")
        raise RuntimeError(f"Falha ao gerar dump do PostgreSQL: {err_msg}")

def restore_db_dump(file_bytes: bytes) -> bool:
    """Restaura o dump do banco de dados a partir dos bytes compactados."""
    try:
        raw_data = gzip.decompress(file_bytes)
    except Exception:
        # Se não estiver compactado em gzip, usa direto
        raw_data = file_bytes

    db_info = parse_db_url()
    if db_info["driver"] == "sqlite":
        sqlite_file = db_info["path"]
        with open(sqlite_file, "wb") as f:
            f.write(raw_data)
        logger.info("Banco de dados SQLite restaurado com sucesso!")
        return True

    # Restauração no PostgreSQL via pg_restore
    try:
        from app.core.database import engine
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid != pg_backend_pid();"))
            conn.commit()
        engine.dispose()
    except Exception as term_err:
        logger.warning(f"Não foi possível desconectar sessões ativas antes do restore: {term_err}")

    env = os.environ.copy()
    env["PGPASSWORD"] = db_info["password"]
    cmd = [
        "pg_restore",
        "-h", db_info["host"],
        "-p", db_info["port"],
        "-U", db_info["user"],
        "-d", db_info["database"],
        "--clean", # Limpa objetos antes de recriá-los
        "--if-exists",
        "--no-owner",
    ]
    try:
        proc = subprocess.run(
            cmd,
            input=raw_data,
            timeout=30,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if proc.returncode not in [0, 1]: # pg_restore pode retornar 1 para warnings normais
            err_msg = proc.stderr.decode('utf-8', errors='ignore')
            logger.error(f"Aviso/Erro pg_restore: {err_msg}")
        logger.info("Restauração do PostgreSQL concluída!")
        return True
    except Exception as e:
        logger.error(f"Erro inesperado no restore_db_dump: {e}")
        raise RuntimeError(f"Falha ao restaurar banco de dados: {e}")

def enforce_retention_limit(db: Session, folder: str = None, max_limit: int = 30):
    """Garante que a quantidade de backups no bucket não ultrapasse o limite de retenção (FIFO)."""
    backups = db.query(BackupHistory).filter(BackupHistory.status == "success").order_by(BackupHistory.id.asc()).all()
    count = len(backups)
    if count > max_limit:
        excess = count - max_limit
        to_delete = backups[:excess]
        for bkp in to_delete:
            logger.info(f"Removendo backup antigo por limite de retenção ({max_limit}): {bkp.filename}")
            try:
                delete_backup_file(bkp.s3_key, bkp.filename)
            except Exception as e:
                logger.error(f"Erro ao remover arquivo físico no S3: {e}")
            db.delete(bkp)
        db.commit()

import re

def create_backup_record(
    db: Session,
    backup_type: str = "manual",
    custom_bytes: bytes = None,
    original_filename: str = None,
    custom_name: str = None
) -> BackupHistory:
    """Gera um dump, envia ao S3/B2, salva registro no banco e expurga os mais antigos."""
    now = utc_now()
    if custom_bytes is not None and original_filename:
        # Importação externa
        dump_bytes = custom_bytes
        filename = original_filename
    else:
        # Geração automática ou manual
        dump_bytes = generate_db_dump()
        # Horário de Brasília no nome do arquivo para fácil identificação pelo usuário
        timestamp_str = brasilia_now().strftime("%Y_%m_%d_%H_%M_%S")
        
        if custom_name and custom_name.strip():
            # Limpa caracteres especiais mantendo alfanuméricos, hífen e underscore
            clean_name = re.sub(r'[^a-zA-Z0-9_\-]', '_', custom_name.strip())
            # Remove sufixo .dump.gz se o usuário tiver digitado
            clean_name = re.sub(r'(\.dump|\.gz|\.dump\.gz)$', '', clean_name, flags=re.IGNORECASE)
            filename = f"{clean_name}_{timestamp_str}.dump.gz"
        else:
            filename = f"vturb_backup_{timestamp_str}.dump.gz"

    file_size = len(dump_bytes)
    
    # Obtém pasta de destino configurada
    schedule = db.query(BackupSchedule).first()
    folder = schedule.destination_folder if schedule else settings.B2_FOLDER
    retention_max = schedule.retention_max if schedule else settings.B2_RETENTION_MAX

    s3_key = upload_backup_file(dump_bytes, filename, folder)

    # Cria registro no banco de dados
    history = BackupHistory(
        filename=filename,
        s3_key=s3_key,
        file_size_bytes=file_size,
        backup_type=backup_type,
        status="success",
        created_at=now
    )
    db.add(history)

    # Atualiza last_run_at se agendado
    if schedule:
        schedule.last_run_at = now
    db.commit()
    db.refresh(history)

    # Aplica retenção
    enforce_retention_limit(db, folder, retention_max)

    return history

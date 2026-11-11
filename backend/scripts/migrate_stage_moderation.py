"""
Script de migração para adicionar permissões de moderação de palco (can_moderate_stage) em server_roles.
Suporta PostgreSQL e SQLite.
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine
from app.core.logger import logger


def run_migration():
    logger.info("Iniciando migração de permissões de canal de palco (can_moderate_stage)...")

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # 1. Adiciona a coluna can_moderate_stage se não existir
            conn.execute(text("""
                ALTER TABLE server_roles
                ADD COLUMN IF NOT EXISTS can_moderate_stage BOOLEAN NOT NULL DEFAULT FALSE;
            """))

            trans.commit()
            logger.info("Migração can_moderate_stage em server_roles concluída com sucesso!")
        except Exception as err:
            trans.rollback()
            logger.error(f"Erro ao executar migração can_moderate_stage: {err}")
            raise err


if __name__ == "__main__":
    run_migration()

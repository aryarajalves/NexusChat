"""
Script de migração para a tabela de sons do soundboard do servidor: server_soundboard_sounds.
Suporta PostgreSQL e SQLite.
"""
import sys
import os

# Adiciona o diretório raiz do backend ao sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine
from app.core.logger import logger


def run_migration():
    logger.info("Iniciando migração da tabela server_soundboard_sounds...")

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # 1. Cria a tabela server_soundboard_sounds se não existir
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS server_soundboard_sounds (
                    id SERIAL PRIMARY KEY,
                    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    name VARCHAR(64) NOT NULL,
                    emoji VARCHAR(16) NOT NULL DEFAULT '🔊',
                    audio_url VARCHAR(500) NOT NULL,
                    volume FLOAT NOT NULL DEFAULT 1.0,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
                );
            """))

            # 2. Cria índices para performance
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_server_soundboard_server_id ON server_soundboard_sounds (server_id);
            """))

            # 3. Constraint de unicidade por servidor e nome
            try:
                conn.execute(text("""
                    ALTER TABLE server_soundboard_sounds
                    ADD CONSTRAINT uq_server_soundboard_server_name UNIQUE (server_id, name);
                """))
            except Exception as e:
                logger.info(f"Constraint de unicidade já existente ou tratada: {e}")

            trans.commit()
            logger.info("Migração de server_soundboard_sounds concluída com sucesso!")
        except Exception as err:
            trans.rollback()
            logger.error(f"Erro ao executar migração de server_soundboard_sounds: {err}")
            raise err


if __name__ == "__main__":
    run_migration()

"""
Script de migração para a tabela de emojis customizados do servidor: server_emojis.
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
    logger.info("Iniciando migração da tabela server_emojis...")

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # 1. Cria a tabela server_emojis se não existir
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS server_emojis (
                    id SERIAL PRIMARY KEY,
                    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    name VARCHAR(50) NOT NULL,
                    image_url VARCHAR(500) NOT NULL,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
                );
            """))

            # 2. Cria índices para performance
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_server_emojis_server_id ON server_emojis (server_id);
            """))

            # 3. Constraint de unicidade por servidor e nome
            # Verifica se já existe antes de criar
            try:
                conn.execute(text("""
                    ALTER TABLE server_emojis
                    ADD CONSTRAINT uq_server_emoji_server_name UNIQUE (server_id, name);
                """))
            except Exception as e:
                # Já existe ou não suportado (ex: SQLite ou reexecução)
                logger.info(f"Constraint de unicidade já existente ou tratada: {e}")

            trans.commit()
            logger.info("Migração de server_emojis concluída com sucesso!")
        except Exception as err:
            trans.rollback()
            logger.error(f"Erro ao executar migração de server_emojis: {err}")
            raise err


if __name__ == "__main__":
    run_migration()

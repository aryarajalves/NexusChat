"""
Script de Migração: Adiciona suporte a Canais Privados e Permissões por Cargo.
Tabelas afetadas:
- channels: adiciona coluna is_private (BOOLEAN DEFAULT FALSE)
- channel_role_permissions: nova tabela de associação (channel_id, role_id)
"""
import os
import sys

# Adiciona o diretório raiz do backend ao sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.core.config import settings

def run_migration():
    database_url = settings.DATABASE_URL
    print(f"[*] Conectando ao banco de dados: {database_url}")
    engine = create_engine(database_url)

    with engine.connect() as conn:
        with conn.begin():
            # 1. Adiciona coluna is_private na tabela channels se não existir
            print("[*] Verificando coluna is_private na tabela channels...")
            conn.execute(text("""
                ALTER TABLE channels 
                ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;
            """))

            # 2. Cria tabela channel_role_permissions se não existir
            print("[*] Verificando tabela channel_role_permissions...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS channel_role_permissions (
                    id SERIAL PRIMARY KEY,
                    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                    role_id INTEGER NOT NULL REFERENCES server_roles(id) ON DELETE CASCADE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_channel_role UNIQUE (channel_id, role_id)
                );
            """))

            # 3. Cria índices para performance
            print("[*] Criando índices para channel_role_permissions...")
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_channel_role_channel_id 
                ON channel_role_permissions (channel_id);
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_channel_role_role_id 
                ON channel_role_permissions (role_id);
            """))

    print("[+] Migração de Canais Privados concluída com sucesso!")

if __name__ == "__main__":
    run_migration()

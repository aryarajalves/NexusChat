"""
Script de Migração: Adiciona suporte ao Sistema de Boas-Vindas Configurável por Servidor.
Tabelas afetadas:
- servers: adiciona colunas welcome_enabled, welcome_channel_id e welcome_message.
"""
import os
import sys

# Adiciona o diretório raiz do backend ao sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect, text

from app.core.config import settings
from app.models.discord import DEFAULT_WELCOME_MESSAGE


def run_migration():
    database_url = settings.DATABASE_URL
    print(f"[*] Conectando ao banco de dados para migração de boas-vindas...")
    engine = create_engine(database_url)
    inspector = inspect(engine)
    existing_columns = {col["name"] for col in inspector.get_columns("servers")}

    with engine.connect() as conn:
        with conn.begin():
            if "welcome_enabled" not in existing_columns:
                print("[*] Adicionando coluna welcome_enabled na tabela servers...")
                conn.execute(
                    text("ALTER TABLE servers ADD COLUMN welcome_enabled BOOLEAN NOT NULL DEFAULT FALSE;")
                )

            if "welcome_channel_id" not in existing_columns:
                print("[*] Adicionando coluna welcome_channel_id na tabela servers...")
                if engine.dialect.name == "postgresql":
                    conn.execute(
                        text(
                            "ALTER TABLE servers ADD COLUMN welcome_channel_id INTEGER "
                            "REFERENCES channels(id) ON DELETE SET NULL;"
                        )
                    )
                else:
                    conn.execute(
                        text("ALTER TABLE servers ADD COLUMN welcome_channel_id INTEGER;")
                    )

            if "welcome_message" not in existing_columns:
                print("[*] Adicionando coluna welcome_message na tabela servers...")
                conn.execute(
                    text("ALTER TABLE servers ADD COLUMN welcome_message VARCHAR(2000);")
                )
                conn.execute(
                    text("UPDATE servers SET welcome_message = :msg WHERE welcome_message IS NULL;"),
                    {"msg": DEFAULT_WELCOME_MESSAGE},
                )

    print("[+] Migração do Sistema de Boas-Vindas concluída com sucesso!")


if __name__ == "__main__":
    run_migration()

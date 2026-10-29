"""
Script de migração para criação da tabela server_roles e adição de banner_url em servers e role_id em server_members.
Compatível com PostgreSQL e SQLite.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine, Base
import app.models.discord  # noqa: F401

def migrate():
    print("Iniciando migração de server_roles, banner_url e role_id...")
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # 1. Coluna banner_url na tabela servers
        try:
            conn.execute(text("ALTER TABLE servers ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);"))
            conn.commit()
            print("Coluna 'banner_url' adicionada com sucesso em 'servers'.")
        except Exception as e:
            try:
                conn.execute(text("ALTER TABLE servers ADD COLUMN banner_url VARCHAR(500);"))
                conn.commit()
                print("Coluna 'banner_url' adicionada em 'servers' (SQLite).")
            except Exception as e2:
                print(f"Nota na adição de banner_url: {e2}")

        # 2. Tabela server_roles
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS server_roles (
                    id SERIAL PRIMARY KEY,
                    server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    color VARCHAR(20) NOT NULL DEFAULT '#99aab5',
                    position INTEGER NOT NULL DEFAULT 0,
                    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
                    hoist BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.commit()
            print("Tabela 'server_roles' verificada/criada com sucesso.")
        except Exception as e:
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS server_roles (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                        name VARCHAR(100) NOT NULL,
                        color VARCHAR(20) NOT NULL DEFAULT '#99aab5',
                        position INTEGER NOT NULL DEFAULT 0,
                        is_admin BOOLEAN NOT NULL DEFAULT 0,
                        hoist BOOLEAN NOT NULL DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                """))
                conn.commit()
                print("Tabela 'server_roles' criada (formato SQLite).")
            except Exception as e2:
                print(f"Nota na criação de server_roles: {e2}")

        # 3. Coluna role_id na tabela server_members
        try:
            conn.execute(text("ALTER TABLE server_members ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES server_roles(id) ON DELETE SET NULL;"))
            conn.commit()
            print("Coluna 'role_id' adicionada com sucesso em 'server_members'.")
        except Exception as e:
            try:
                conn.execute(text("ALTER TABLE server_members ADD COLUMN role_id INTEGER REFERENCES server_roles(id) ON DELETE SET NULL;"))
                conn.commit()
                print("Coluna 'role_id' adicionada em 'server_members' (SQLite).")
            except Exception as e2:
                print(f"Nota na adição de role_id: {e2}")

    print("Migração de server_roles e configurações do servidor finalizada com sucesso!")

if __name__ == "__main__":
    migrate()

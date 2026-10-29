"""
Script de migração para criação das tabelas do Discord Clone:
- servers
- channels
- server_members
- messages
- server_invites
E adição da coluna max_servers em users e invites.
Compatível com PostgreSQL e SQLite.
"""
import os
import sys

# Garante que a pasta backend/ esteja no PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine, Base
from app.models.user import User, Invite
from app.models.discord import Server, Channel, ServerMember, Message, ServerInvite

def migrate():
    print("Iniciando migração do esquema do Discord Clone...")
    # Cria novas tabelas mapeadas no SQLAlchemy
    Base.metadata.create_all(bind=engine)

    # Adiciona max_servers nas tabelas existentes de users e invites
    with engine.connect() as conn:
        # Coluna max_servers na tabela users
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN max_servers INTEGER DEFAULT 100;"))
            conn.commit()
            print("Coluna max_servers adicionada com sucesso em users.")
        except Exception:
            # Já existe ou não suportado
            pass

        # Coluna max_servers na tabela invites
        try:
            conn.execute(text("ALTER TABLE invites ADD COLUMN max_servers INTEGER DEFAULT 100;"))
            conn.commit()
            print("Coluna max_servers adicionada com sucesso em invites.")
        except Exception:
            pass

    print("Migração do esquema do Discord concluída com sucesso!")

if __name__ == "__main__":
    migrate()

"""
Script de migração para adição da coluna is_pinned nas tabelas messages e dm_messages.
Compatível com PostgreSQL e SQLite.
"""
import os
import sys

# Garante que a pasta backend/ esteja no PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine, Base

def migrate():
    print("Iniciando migração da coluna is_pinned nas tabelas messages e dm_messages...")
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # Coluna is_pinned em messages
        try:
            conn.execute(text("ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;"))
            conn.commit()
            print("Coluna is_pinned verificada/adicionada com sucesso em messages.")
        except Exception as e:
            try:
                conn.execute(text("ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0;"))
                conn.commit()
                print("Coluna is_pinned adicionada (formato SQLite) em messages.")
            except Exception as e2:
                print(f"Coluna is_pinned já existe em messages: {e2}")

        # Coluna is_pinned em dm_messages
        try:
            conn.execute(text("ALTER TABLE dm_messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;"))
            conn.commit()
            print("Coluna is_pinned verificada/adicionada com sucesso em dm_messages.")
        except Exception as e:
            try:
                conn.execute(text("ALTER TABLE dm_messages ADD COLUMN is_pinned BOOLEAN NOT NULL DEFAULT 0;"))
                conn.commit()
                print("Coluna is_pinned adicionada (formato SQLite) em dm_messages.")
            except Exception as e2:
                print(f"Coluna is_pinned já existe em dm_messages: {e2}")

    print("Migração de is_pinned concluída com sucesso!")

if __name__ == "__main__":
    migrate()

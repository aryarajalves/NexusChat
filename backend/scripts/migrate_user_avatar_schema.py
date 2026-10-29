"""
Script de migração para adição da coluna avatar_url na tabela users.
Compatível com PostgreSQL e SQLite.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine, Base
import app.models.user  # noqa: F401

def migrate():
    print("Iniciando migração da coluna avatar_url na tabela users...")
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);"))
            conn.commit()
            print("Coluna 'avatar_url' adicionada com sucesso em 'users'.")
        except Exception as e:
            try:
                conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500);"))
                conn.commit()
                print("Coluna 'avatar_url' adicionada em 'users' (SQLite).")
            except Exception as e2:
                print(f"Nota na adição de avatar_url: {e2}")

    print("Migração de avatar_url finalizada com sucesso!")

if __name__ == "__main__":
    migrate()

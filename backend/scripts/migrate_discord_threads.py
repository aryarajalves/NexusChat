"""
Script de migração para criação das tabelas message_threads e thread_messages.
Compatível com PostgreSQL e SQLite.
"""
import os
import sys

# Garante que a pasta backend/ esteja no PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine, Base
import app.models.user  # Garante registro dos modelos de usuário
import app.models.discord  # Garante registro dos modelos de discord


def migrate():
    print("Iniciando migração de Tópicos (Threads) no banco de dados...")

    with engine.connect() as conn:
        dialect = engine.dialect.name
        print(f"Dialeto detectado: {dialect}")

        if dialect == "postgresql":
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS message_threads (
                    id SERIAL PRIMARY KEY,
                    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                    root_message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
                    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
                    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc')
                );
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_message_threads_channel_id ON message_threads (channel_id);
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_message_threads_root_message_id ON message_threads (root_message_id);
            """))

            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS thread_messages (
                    id SERIAL PRIMARY KEY,
                    thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
                    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    content VARCHAR(2000) NOT NULL,
                    attachment_url VARCHAR(500),
                    attachment_type VARCHAR(50),
                    attachment_size INTEGER,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'utc'),
                    updated_at TIMESTAMP WITHOUT TIME ZONE
                );
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id ON thread_messages (thread_id);
            """))
            conn.commit()
            print("Tabelas message_threads e thread_messages criadas/verificadas com sucesso no PostgreSQL.")
        else:
            # SQLite
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS message_threads (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                    root_message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
                    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                );
            """))
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS thread_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    thread_id INTEGER NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
                    author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    content VARCHAR(2000) NOT NULL,
                    attachment_url VARCHAR(500),
                    attachment_type VARCHAR(50),
                    attachment_size INTEGER,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                );
            """))
            conn.commit()
            print("Tabelas message_threads e thread_messages criadas/verificadas com sucesso no SQLite.")

    print("Migração de Tópicos (Threads) concluída com sucesso!")


if __name__ == "__main__":
    migrate()

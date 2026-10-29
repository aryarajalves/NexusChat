"""
Script de migração para criação das tabelas channel_read_states e dm_read_states.
Compatível com PostgreSQL e SQLite.
"""
import os
import sys

# Garante que a pasta backend/ esteja no PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine, Base
import app.models.discord  # noqa: F401

def migrate():
    print("Iniciando migração das tabelas channel_read_states e dm_read_states...")
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # Tabela channel_read_states
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS channel_read_states (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                    last_read_message_id INTEGER,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_channel_read_state_user_channel UNIQUE (user_id, channel_id)
                );
            """))
            conn.commit()
            print("Tabela channel_read_states verificada/criada com sucesso.")
        except Exception as e:
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS channel_read_states (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                        last_read_message_id INTEGER,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT uq_channel_read_state_user_channel UNIQUE (user_id, channel_id)
                    );
                """))
                conn.commit()
                print("Tabela channel_read_states criada (formato SQLite).")
            except Exception as e2:
                print(f"Nota na criação de channel_read_states: {e2}")

        # Tabela dm_read_states
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS dm_read_states (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
                    last_read_message_id INTEGER,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_dm_read_state_user_conversation UNIQUE (user_id, conversation_id)
                );
            """))
            conn.commit()
            print("Tabela dm_read_states verificada/criada com sucesso.")
        except Exception as e:
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS dm_read_states (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
                        last_read_message_id INTEGER,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT uq_dm_read_state_user_conversation UNIQUE (user_id, conversation_id)
                    );
                """))
                conn.commit()
                print("Tabela dm_read_states criada (formato SQLite).")
            except Exception as e2:
                print(f"Nota na criação de dm_read_states: {e2}")

    print("Migração de tabelas de leitura concluída com sucesso!")

if __name__ == "__main__":
    migrate()

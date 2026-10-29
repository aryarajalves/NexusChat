"""
Script de migração para criação de índices compostos de alta performance nas tabelas messages e dm_messages.
Compatível com PostgreSQL e SQLite.
"""
import os
import sys

# Garante que a pasta backend/ esteja no PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine, Base
import app.models.user
import app.models.discord

def migrate():
    print("Iniciando migração de índices compostos para escalabilidade de mensagens...")
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        # Índice composto na tabela messages (channel_id, id)
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_channel_id_id ON messages (channel_id, id DESC);"))
            conn.commit()
            print("Índice composto idx_messages_channel_id_id criado/verificado com sucesso em messages.")
        except Exception as e:
            try:
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_channel_id_id ON messages (channel_id, id);"))
                conn.commit()
                print("Índice composto idx_messages_channel_id_id criado (formato fallback) em messages.")
            except Exception as e2:
                print(f"Erro ao criar índice em messages: {e2}")

        # Índice composto na tabela dm_messages (conversation_id, id)
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation_id_id ON dm_messages (conversation_id, id DESC);"))
            conn.commit()
            print("Índice composto idx_dm_messages_conversation_id_id criado/verificado com sucesso em dm_messages.")
        except Exception as e:
            try:
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_dm_messages_conversation_id_id ON dm_messages (conversation_id, id);"))
                conn.commit()
                print("Índice composto idx_dm_messages_conversation_id_id criado (formato fallback) em dm_messages.")
            except Exception as e2:
                print(f"Erro ao criar índice em dm_messages: {e2}")

    print("Migração de índices compostos concluída com sucesso!")

if __name__ == "__main__":
    migrate()

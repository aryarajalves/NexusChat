#!/usr/bin/env python3
"""
Script de migração para criação de índices em ForeignKeys que não possuíam index=True explícito.
Garante que 100% das chaves estrangeiras estejam indexadas no PostgreSQL e SQLite.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine

def migrate():
    print("Aplicando indices nas ForeignKeys do Discord...")
    indexes = [
        ("idx_servers_welcome_channel_id", "servers", "welcome_channel_id"),
        ("idx_messages_reply_to_id", "messages", "reply_to_id"),
        ("idx_server_invites_created_by_id", "server_invites", "created_by_id"),
        ("idx_dm_messages_reply_to_id", "dm_messages", "reply_to_id"),
        ("idx_server_emojis_user_id", "server_emojis", "user_id"),
        ("idx_server_soundboard_sounds_user_id", "server_soundboard_sounds", "user_id"),
    ]

    with engine.begin() as conn:
        for idx_name, table, col in indexes:
            try:
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({col});"))
                print(f"  [OK] Indice {idx_name} criado/verificado em {table}({col}).")
            except Exception as e:
                print(f"  [AVISO] {idx_name}: {e}")

    print("Migracao de indices concluida com sucesso!")

if __name__ == "__main__":
    migrate()

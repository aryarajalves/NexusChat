"""
Script de migração para criação das tabelas de DMs (Mensagens Diretas e Conversas Privadas).
Tabelas: dm_conversations, dm_messages, dm_message_reactions.
Compatível com PostgreSQL e SQLite.
"""
import os
import sys

# Garante que a pasta backend/ esteja no PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import engine, Base
from app.models.discord import DMConversation, DMMessage, DMMessageReaction

def migrate():
    print("Iniciando migração das tabelas de DMs (dm_conversations, dm_messages, dm_message_reactions)...")
    Base.metadata.create_all(bind=engine)
    print("Tabelas de DMs criadas/verificadas com sucesso!")

if __name__ == "__main__":
    migrate()

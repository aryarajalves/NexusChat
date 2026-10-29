"""
Script de migração para criação da tabela message_reactions no banco de dados.
Compatível com PostgreSQL e SQLite.
"""
import os
import sys

# Garante que a pasta backend/ esteja no PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine, Base
from app.models.discord import MessageReaction

def migrate():
    print("Iniciando migração da tabela message_reactions...")
    Base.metadata.create_all(bind=engine)
    print("Tabela message_reactions verificada/criada com sucesso!")

if __name__ == "__main__":
    migrate()

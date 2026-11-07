"""
Script de Migração: Criação da tabela voice_recordings para gravações de canais de voz integradas ao Backblaze B2.
Tabela afetada:
- voice_recordings: armazena metadados de gravações de voz e vídeo na nuvem.
"""
import os
import sys

# Adiciona o diretório raiz do backend ao sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, inspect, text
from app.core.config import settings


def run_migration():
    database_url = settings.DATABASE_URL
    print("[*] Conectando ao banco de dados para migração de gravações de voz (voice_recordings)...")
    engine = create_engine(database_url)
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.connect() as conn:
        with conn.begin():
            if "voice_recordings" not in existing_tables:
                print("[*] Criando tabela voice_recordings...")
                if engine.dialect.name == "postgresql":
                    conn.execute(
                        text(
                            """
                            CREATE TABLE voice_recordings (
                                id SERIAL PRIMARY KEY,
                                server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                                channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                title VARCHAR(255) NOT NULL,
                                filename VARCHAR(255) NOT NULL,
                                s3_key VARCHAR(500),
                                storage VARCHAR(32) NOT NULL DEFAULT 'b2',
                                file_size INTEGER NOT NULL DEFAULT 0,
                                duration_seconds INTEGER NOT NULL DEFAULT 0,
                                record_type VARCHAR(20) NOT NULL DEFAULT 'video',
                                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                            );
                            """
                        )
                    )
                    conn.execute(text("CREATE INDEX idx_voice_recordings_server_id ON voice_recordings(server_id);"))
                    conn.execute(text("CREATE INDEX idx_voice_recordings_channel_id ON voice_recordings(channel_id);"))
                    conn.execute(text("CREATE INDEX idx_voice_recordings_user_id ON voice_recordings(user_id);"))
                else:
                    conn.execute(
                        text(
                            """
                            CREATE TABLE voice_recordings (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
                                channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
                                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                title VARCHAR(255) NOT NULL,
                                filename VARCHAR(255) NOT NULL,
                                s3_key VARCHAR(500),
                                storage VARCHAR(32) NOT NULL DEFAULT 'b2',
                                file_size INTEGER NOT NULL DEFAULT 0,
                                duration_seconds INTEGER NOT NULL DEFAULT 0,
                                record_type VARCHAR(20) NOT NULL DEFAULT 'video',
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            );
                            """
                        )
                    )
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_voice_recordings_server_id ON voice_recordings(server_id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_voice_recordings_channel_id ON voice_recordings(channel_id);"))
                    conn.execute(text("CREATE INDEX IF NOT EXISTS idx_voice_recordings_user_id ON voice_recordings(user_id);"))
                print("[+] Tabela voice_recordings criada com sucesso!")
            else:
                print("[*] Tabela voice_recordings já existe.")

    print("[+] Migração de gravações de canais de voz concluída com sucesso!")


if __name__ == "__main__":
    run_migration()

"""
Script de migração para criação das tabelas de Infraestrutura e Monitoramento:
- system_alert_configs
- system_peak_metrics
- system_connection_histories
Executável tanto em PostgreSQL quanto em SQLite.
"""
from sqlalchemy import text
from app.core.database import engine

def migrate():
    print("Iniciando migração das tabelas de infraestrutura...")
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS system_alert_configs (
                id SERIAL PRIMARY KEY,
                pool_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                pool_alert_threshold INTEGER NOT NULL DEFAULT 75,
                ram_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                ram_alert_threshold INTEGER NOT NULL DEFAULT 80,
                cpu_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                cpu_alert_threshold INTEGER NOT NULL DEFAULT 85,
                cooldown_minutes INTEGER NOT NULL DEFAULT 15,
                webhook_url VARCHAR NOT NULL DEFAULT '',
                notify_normalized BOOLEAN NOT NULL DEFAULT TRUE,
                last_alert_sent_at TIMESTAMP WITH TIME ZONE NULL,
                last_normalized_sent_at TIMESTAMP WITH TIME ZONE NULL,
                is_currently_critical BOOLEAN NOT NULL DEFAULT FALSE,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS system_peak_metrics (
                id SERIAL PRIMARY KEY,
                metric_type VARCHAR(50) NOT NULL,
                peak_value FLOAT NOT NULL,
                peak_details VARCHAR(255) NULL,
                recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS system_connection_histories (
                id SERIAL PRIMARY KEY,
                hour_period VARCHAR(50) NOT NULL,
                peak_connections INTEGER NOT NULL DEFAULT 1,
                pool_capacity INTEGER NOT NULL DEFAULT 50,
                occupancy_pct FLOAT NOT NULL DEFAULT 2.0,
                status VARCHAR(50) NOT NULL DEFAULT 'Normal',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        """))

        conn.commit()
    print("Migração das tabelas de infraestrutura concluída com sucesso!")

if __name__ == "__main__":
    migrate()

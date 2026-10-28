"""
Modelos de Banco de Dados para Infraestrutura, Métricas de Hardware e Alertas por Webhook.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime
from app.core.database import Base


class SystemAlertConfig(Base):
    __tablename__ = "system_alert_configs"

    id = Column(Integer, primary_key=True, index=True)
    pool_alert_enabled = Column(Boolean, default=True, nullable=False)
    pool_alert_threshold = Column(Integer, default=75, nullable=False)  # % de uso do pool
    ram_alert_enabled = Column(Boolean, default=True, nullable=False)
    ram_alert_threshold = Column(Integer, default=80, nullable=False)  # % de uso de RAM
    cpu_alert_enabled = Column(Boolean, default=True, nullable=False)
    cpu_alert_threshold = Column(Integer, default=85, nullable=False)  # % de uso de CPU
    cooldown_minutes = Column(Integer, default=15, nullable=False)
    webhook_url = Column(String, default="", nullable=False)
    notify_normalized = Column(Boolean, default=True, nullable=False)
    last_alert_sent_at = Column(DateTime, nullable=True)
    last_normalized_sent_at = Column(DateTime, nullable=True)
    is_currently_critical = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class SystemPeakMetric(Base):
    __tablename__ = "system_peak_metrics"

    id = Column(Integer, primary_key=True, index=True)
    metric_type = Column(String(50), index=True, nullable=False)  # 'ram', 'cpu', 'pool'
    peak_value = Column(Float, nullable=False)
    peak_details = Column(String(255), nullable=True)
    recorded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class SystemConnectionHistory(Base):
    __tablename__ = "system_connection_histories"

    id = Column(Integer, primary_key=True, index=True)
    hour_period = Column(String(50), index=True, nullable=False)  # "22/10/2026 14:00"
    peak_connections = Column(Integer, default=1, nullable=False)
    pool_capacity = Column(Integer, default=50, nullable=False)
    occupancy_pct = Column(Float, default=2.0, nullable=False)
    status = Column(String(50), default="Normal", nullable=False)  # Normal, Atenção, Crítico
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

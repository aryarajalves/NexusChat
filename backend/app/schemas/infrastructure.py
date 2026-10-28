"""
Schemas Pydantic para Infraestrutura, Métricas de Hardware e Configuração de Alertas Webhook.
"""
from typing import List, Optional
from pydantic import BaseModel


class HardwareMetrics(BaseModel):
    ram_used_gb: float
    ram_total_gb: float
    ram_free_gb: float
    ram_pct: float
    api_container_mb: float
    ram_status: str
    cpu_pct: float
    vcpus: int
    cpu_status: str
    peak_ram_pct: float
    peak_ram_details: str
    peak_ram_recorded_at: str
    peak_cpu_pct: float
    peak_cpu_recorded_at: str


class ConnectionHistoryItem(BaseModel):
    period: str
    peak_connections: int
    pool_capacity: int
    occupancy_pct: float
    status: str


class DatabaseMetrics(BaseModel):
    active_connections: int
    pool_capacity: int
    pool_base: int
    overflow_reserve: int
    occupancy_pct: float
    idle_connections: int
    status: str
    peak_connections_today: int
    peak_pct_today: float
    peak_time_today: str
    history_24h: List[ConnectionHistoryItem]


class InfrastructureOverview(BaseModel):
    hardware: HardwareMetrics
    database: DatabaseMetrics
    alert_badge: str  # "Ativo" ou "Inativo"


class AlertConfigResponse(BaseModel):
    pool_alert_enabled: bool
    pool_alert_threshold: int
    ram_alert_enabled: bool
    ram_alert_threshold: int
    cpu_alert_enabled: bool
    cpu_alert_threshold: int
    cooldown_minutes: int
    webhook_url: str
    notify_normalized: bool
    is_active: bool


class AlertConfigUpdate(BaseModel):
    pool_alert_enabled: Optional[bool] = None
    pool_alert_threshold: Optional[int] = None
    ram_alert_enabled: Optional[bool] = None
    ram_alert_threshold: Optional[int] = None
    cpu_alert_enabled: Optional[bool] = None
    cpu_alert_threshold: Optional[int] = None
    cooldown_minutes: Optional[int] = None
    webhook_url: Optional[str] = None
    notify_normalized: Optional[bool] = None


class WebhookTestRequest(BaseModel):
    webhook_url: str


class WebhookTestResponse(BaseModel):
    success: bool
    message: str
    status_code: Optional[int] = None

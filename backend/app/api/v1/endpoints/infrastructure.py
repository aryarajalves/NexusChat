"""
Endpoints de Monitoramento de Infraestrutura, Recursos de Hardware e Alertas por Webhook.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.api.v1.endpoints.users import require_admin_or_superadmin
from app.core.config import settings
from app.schemas.infrastructure import (
    InfrastructureOverview,
    AlertConfigResponse,
    AlertConfigUpdate,
    WebhookTestRequest,
    WebhookTestResponse
)
from app.services.infrastructure_service import (
    get_hardware_metrics,
    get_database_pool_metrics,
    get_or_create_alert_config,
    send_webhook_alert,
    check_and_trigger_resource_alerts,
    _now_brasilia
)

router = APIRouter(prefix="/infrastructure", tags=["Infraestrutura e Recursos"])


@router.get(
    "/overview",
    response_model=InfrastructureOverview,
    summary="Visão Geral de Recursos e Banco de Dados",
    description="Retorna métricas em tempo real de Memória RAM, CPU, Conexões do Pool PostgreSQL e Picos de 24h."
)
def get_infrastructure_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin)
):
    hardware = get_hardware_metrics(db)
    database = get_database_pool_metrics(db)
    config = get_or_create_alert_config(db)

    try:
        check_and_trigger_resource_alerts(db)
    except Exception:
        pass

    alert_badge = "Ativo" if (config.webhook_url and (config.pool_alert_enabled or config.ram_alert_enabled or config.cpu_alert_enabled)) else "Inativo"

    return {
        "hardware": hardware,
        "database": database,
        "alert_badge": alert_badge,
    }


@router.get(
    "/alerts/config",
    response_model=AlertConfigResponse,
    summary="Obter Configurações de Alertas de Webhook",
    description="Retorna thresholds de disparo, cooldown e URL do webhook configurado."
)
def get_alert_configuration(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin)
):
    config = get_or_create_alert_config(db)
    is_active = bool(config.webhook_url and (config.pool_alert_enabled or config.ram_alert_enabled or config.cpu_alert_enabled))
    return {
        "pool_alert_enabled": config.pool_alert_enabled,
        "pool_alert_threshold": config.pool_alert_threshold,
        "ram_alert_enabled": config.ram_alert_enabled,
        "ram_alert_threshold": config.ram_alert_threshold,
        "cpu_alert_enabled": config.cpu_alert_enabled,
        "cpu_alert_threshold": config.cpu_alert_threshold,
        "cooldown_minutes": config.cooldown_minutes,
        "webhook_url": config.webhook_url,
        "notify_normalized": config.notify_normalized,
        "is_active": is_active,
    }


@router.put(
    "/alerts/config",
    response_model=AlertConfigResponse,
    summary="Atualizar Configurações de Alertas de Webhook",
    description="Permite que o administrador altere limites de disparo para RAM, CPU, Pool de Conexões e URL de notificação."
)
def update_alert_configuration(
    payload: AlertConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_superadmin)
):
    config = get_or_create_alert_config(db)

    if payload.pool_alert_enabled is not None:
        config.pool_alert_enabled = payload.pool_alert_enabled
    if payload.pool_alert_threshold is not None:
        config.pool_alert_threshold = max(5, min(100, payload.pool_alert_threshold))
    if payload.ram_alert_enabled is not None:
        config.ram_alert_enabled = payload.ram_alert_enabled
    if payload.ram_alert_threshold is not None:
        config.ram_alert_threshold = max(10, min(100, payload.ram_alert_threshold))
    if payload.cpu_alert_enabled is not None:
        config.cpu_alert_enabled = payload.cpu_alert_enabled
    if payload.cpu_alert_threshold is not None:
        config.cpu_alert_threshold = max(10, min(100, payload.cpu_alert_threshold))
    if payload.cooldown_minutes is not None:
        config.cooldown_minutes = max(1, min(1440, payload.cooldown_minutes))
    if payload.webhook_url is not None:
        config.webhook_url = payload.webhook_url.strip()
    if payload.notify_normalized is not None:
        config.notify_normalized = payload.notify_normalized

    db.commit()
    db.refresh(config)

    is_active = bool(config.webhook_url and (config.pool_alert_enabled or config.ram_alert_enabled or config.cpu_alert_enabled))
    return {
        "pool_alert_enabled": config.pool_alert_enabled,
        "pool_alert_threshold": config.pool_alert_threshold,
        "ram_alert_enabled": config.ram_alert_enabled,
        "ram_alert_threshold": config.ram_alert_threshold,
        "cpu_alert_enabled": config.cpu_alert_enabled,
        "cpu_alert_threshold": config.cpu_alert_threshold,
        "cooldown_minutes": config.cooldown_minutes,
        "webhook_url": config.webhook_url,
        "notify_normalized": config.notify_normalized,
        "is_active": is_active,
    }


@router.post(
    "/alerts/test",
    response_model=WebhookTestResponse,
    summary="Testar Disparo de Webhook",
    description="Envia um payload de teste para a URL de webhook especificada para validar conectividade e formato."
)
def test_webhook_endpoint(
    req: WebhookTestRequest,
    current_user: User = Depends(require_admin_or_superadmin)
):
    url = req.webhook_url.strip()
    if not url or not url.startswith("http"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe uma URL de webhook válida com http:// ou https://"
        )

    test_payload = {
        "event": "test_notification",
        "title": f"🧪 Teste de Conexão - Infraestrutura de {settings.PROJECT_NAME}",
        "server": settings.PROJECT_NAME,
        "message": f"Webhook testado com sucesso pelo administrador {current_user.name} ({current_user.email}).",
        "metrics_sample": {
            "database_pool": "Conexão ativa e segura",
            "ram_vps": "Monitoramento em tempo real operacional",
            "cpu": "Normal",
        },
        "timestamp": _now_brasilia().strftime("%d/%m/%Y %H:%M:%S (Horário de Brasília)"),
    }

    result = send_webhook_alert(url, test_payload)
    if not result["success"]:
        return {
            "success": False,
            "message": result["message"],
            "status_code": result.get("status_code")
        }

    return {
        "success": True,
        "message": "Webhook testado com sucesso! A notificação foi entregue ao destino.",
        "status_code": result.get("status_code", 200)
    }

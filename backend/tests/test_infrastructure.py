"""
Testes Unitários de Infraestrutura, Métricas de Hardware e Alertas por Webhook.
"""
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.models.user import User
from app.models.infrastructure import SystemAlertConfig, SystemPeakMetric, SystemConnectionHistory
from app.core.database import Base, get_db
from app.api.v1.endpoints.users import get_current_user
from app.services.infrastructure_service import (
    read_system_ram,
    read_system_cpu,
    get_hardware_metrics,
    get_database_pool_metrics,
    get_or_create_alert_config,
    send_webhook_alert
)

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_infra_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def superadmin_user():
    return User(
        id=1,
        email="superadmin@teste.com",
        name="Super Admin",
        role="superadmin",
        is_active=True
    )


def test_read_system_ram_and_cpu():
    """Valida funções de leitura de RAM e CPU."""
    ram = read_system_ram()
    assert "total_gb" in ram
    assert "used_gb" in ram
    assert "free_gb" in ram
    assert "pct" in ram
    assert ram["total_gb"] > 0
    assert 0 <= ram["pct"] <= 100

    cpu_pct = read_system_cpu()
    assert isinstance(cpu_pct, float)
    assert 0 <= cpu_pct <= 100


def test_get_hardware_and_db_metrics(db_session):
    """Valida cálculo de métricas de hardware e do pool de banco de dados."""
    hw = get_hardware_metrics(db_session)
    assert "ram_used_gb" in hw
    assert "cpu_pct" in hw
    assert "ram_status" in hw
    assert "peak_ram_pct" in hw

    db_m = get_database_pool_metrics(db_session)
    assert "active_connections" in db_m
    assert "pool_capacity" in db_m
    assert "history_24h" in db_m
    assert len(db_m["history_24h"]) > 0


def test_get_or_create_alert_config(db_session):
    """Valida criação e recuperação das configurações de alerta."""
    config = get_or_create_alert_config(db_session)
    assert config.pool_alert_threshold >= 10
    assert config.ram_alert_threshold >= 10
    assert config.cpu_alert_threshold >= 10
    assert config.cooldown_minutes >= 1


def test_send_webhook_alert_invalid_url():
    """Valida rejeição de URL de webhook inválida."""
    res = send_webhook_alert("", {"test": 1})
    assert res["success"] is False
    assert "inválida" in res["message"]


def test_infrastructure_api_endpoints(superadmin_user):
    """Valida endpoints da API /api/v1/infrastructure."""
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: superadmin_user
    client = TestClient(app)

    try:
        # GET overview
        res = client.get("/api/v1/infrastructure/overview")
        assert res.status_code == 200
        data = res.json()
        assert "hardware" in data
        assert "database" in data
        assert "alert_badge" in data

        # GET alert config
        res_cfg = client.get("/api/v1/infrastructure/alerts/config")
        assert res_cfg.status_code == 200
        cfg_data = res_cfg.json()
        assert "pool_alert_threshold" in cfg_data

        # PUT alert config
        res_put = client.put(
            "/api/v1/infrastructure/alerts/config",
            json={
                "pool_alert_threshold": 80,
                "ram_alert_threshold": 85,
                "webhook_url": "https://webhook.site/mock-test",
                "cooldown_minutes": 30
            }
        )
        assert res_put.status_code == 200
        put_data = res_put.json()
        assert put_data["pool_alert_threshold"] == 80
        assert put_data["ram_alert_threshold"] == 85
        assert put_data["cooldown_minutes"] == 30
        assert put_data["webhook_url"] == "https://webhook.site/mock-test"
        assert put_data["is_active"] is True

        # POST test webhook com URL inválida
        res_test_invalid = client.post(
            "/api/v1/infrastructure/alerts/test",
            json={"webhook_url": "invalid-url"}
        )
        assert res_test_invalid.status_code == 400

        # POST test webhook com mock de sucesso
        with patch("app.api.v1.endpoints.infrastructure.send_webhook_alert") as mock_send:
            mock_send.return_value = {"success": True, "message": "OK", "status_code": 200}
            res_test = client.post(
                "/api/v1/infrastructure/alerts/test",
                json={"webhook_url": "https://webhook.site/mock-success"}
            )
            assert res_test.status_code == 200
            assert res_test.json()["success"] is True

    finally:
        app.dependency_overrides.clear()

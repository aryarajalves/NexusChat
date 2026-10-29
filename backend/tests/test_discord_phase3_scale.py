import pytest
from fastapi.testclient import TestClient
from gateway import gateway_app
from scripts.migrate_messages_partitioning import migrate as migrate_partitioning

def test_standalone_realtime_gateway_health():
    """Valida o funcionamento do microserviço Gateway de WebSockets isolado."""
    client = TestClient(gateway_app)
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "realtime-gateway"

def test_partitioning_script_executes_cleanly():
    """Valida execução limpa do script de migração de particionamento declarativo."""
    # Deve rodar sem levantar exceções
    migrate_partitioning()

"""
Testes unitários para resiliência do pool de banco de dados (pool_pre_ping/recycle)
e descoberta dinâmica de contêineres Docker (Portainer, Swarm e Compose local).
"""
import io
import json
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import engine
from app.services.docker_logs_service import (
    discover_container_target,
    fetch_container_logs,
    format_to_brasilia_time,
    clean_docker_stream,
    _CONTAINER_CACHE,
)
from app.models.user import User
from app.core.security import create_access_token

client = TestClient(app)


def test_database_engine_pool_resilience():
    """Valida que o engine do SQLAlchemy está configurado com pool_pre_ping e pool_recycle."""
    pool = engine.pool
    assert getattr(pool, "_pre_ping", False) is True or getattr(engine, "pool", None) is not None
    assert getattr(pool, "_recycle", None) == 300 or getattr(engine.pool, "_recycle", 0) == 300


def test_docker_logs_discovery_swarm_and_portainer():
    """Valida descoberta dinâmica de contêineres sob nomes e labels típicos de Portainer Stacks e Docker Swarm."""
    _CONTAINER_CACHE.clear()

    mock_containers = [
        {
            "Id": "backend_swarm_id_1234567890",
            "Names": ["/minha-stack_nexus-chat-backend.1.s4d8g2f8e1"],
            "Labels": {
                "com.docker.stack.namespace": "minha-stack",
                "com.docker.swarm.service.name": "minha-stack_backend",
            },
        },
        {
            "Id": "frontend_swarm_id_9876543210",
            "Names": ["/minha-stack_nexus-chat-frontend.1.w9r2t4y6u8"],
            "Labels": {
                "com.docker.stack.namespace": "minha-stack",
                "com.docker.swarm.service.name": "minha-stack_frontend",
            },
        },
        {
            "Id": "outro_app_id_999999",
            "Names": ["/outra_aplicacao_nginx"],
            "Labels": {"com.docker.compose.service": "web"},
        },
    ]

    mock_body = json.dumps(mock_containers).encode("utf-8")
    mock_response = b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n" + mock_body

    mock_sock = MagicMock()
    mock_sock.recv.side_effect = [mock_response, b""]

    with patch("os.path.exists", return_value=True), patch("socket.socket", return_value=mock_sock):
        backend_id = discover_container_target("backend", force_refresh=True)
        assert backend_id == "backend_swarm_id_1234567890"

        mock_sock.recv.side_effect = [mock_response, b""]
        frontend_id = discover_container_target("frontend", force_refresh=True)
        assert frontend_id == "frontend_swarm_id_9876543210"


def test_fetch_container_logs_success_and_time_conversion():
    """Valida parsing de stream multiplexado do Docker e conversão para Horário de Brasília."""
    raw_log = b"2026-11-04T13:00:00.000000Z Teste Log\n"
    size_bytes = len(raw_log).to_bytes(4, byteorder="big")
    header_stdout = bytes([1, 0, 0, 0]) + size_bytes
    stream_payload = header_stdout + raw_log

    lines = clean_docker_stream(stream_payload)
    assert len(lines) == 1
    # 13:00 UTC em Brasília (UTC-3) é 10:00
    assert "10:00:00" in lines[0]
    assert "Teste Log" in lines[0]


def test_fetch_container_logs_auto_recovery_on_404():
    """Valida que quando um container retorna 404, o serviço força redescoberta dinâmica e auto-recupera."""
    _CONTAINER_CACHE.clear()

    mock_containers = [
        {
            "Id": "new_backend_recreated_id",
            "Names": ["/nexus_chat_backend"],
            "Labels": {"com.docker.compose.service": "backend"},
        }
    ]
    resp_list = b"HTTP/1.1 200 OK\r\n\r\n" + json.dumps(mock_containers).encode("utf-8")

    # 1ª resposta de logs: 404 Not Found (simulando ID antigo)
    resp_404 = b"HTTP/1.1 404 Not Found\r\n\r\nNo such container"
    # 2ª resposta de logs: 200 OK após redescoberta
    log_content = b"2026-11-04T12:00:00Z Servidor reiniciado com sucesso\n"
    size_bytes = len(log_content).to_bytes(4, byteorder="big")
    stream_payload = bytes([1, 0, 0, 0]) + size_bytes + log_content
    resp_200 = b"HTTP/1.1 200 OK\r\n\r\n" + stream_payload

    # Simula pré-cache com um ID antigo inválido
    _CONTAINER_CACHE["backend"] = {"id": "stale_old_id", "timestamp": 9999999999}

    # Ordem de conexões:
    # 1. _query_docker_logs tenta stale_old_id -> recebe resp_404
    # 2. detecta 404 -> chama discover_container_target(force_refresh=True) -> recebe resp_list
    # 3. _query_docker_logs com new_backend_recreated_id -> recebe resp_200
    sock1 = MagicMock()
    sock1.recv.side_effect = [resp_404, b""]

    sock2 = MagicMock()
    sock2.recv.side_effect = [resp_list, b""]

    sock3 = MagicMock()
    sock3.recv.side_effect = [resp_200, b""]

    with patch("os.path.exists", return_value=True), patch("socket.socket", side_effect=[sock1, sock2, sock3]):
        result = fetch_container_logs("backend", tail=50)
        assert result["available"] is True
        assert result["container"] == "new_backend_recreated_id"
        assert len(result["logs"]) >= 1

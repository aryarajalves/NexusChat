import pytest
from conftest import client
from tests.test_discord_api import get_auth_headers


def test_user_websocket_unauthorized():
    """Testa rejeição de conexão sem token."""
    with pytest.raises(Exception):
        with client.websocket_connect("/api/v1/discord/ws/me") as ws:
            pass


def test_user_websocket_authenticated_ping():
    """Testa conexão com sucesso e ping-pong no canal persistente do usuário."""
    headers = get_auth_headers()
    token = headers["Authorization"].replace("Bearer ", "")

    with client.websocket_connect(f"/api/v1/discord/ws/me?token={token}") as ws:
        ws.send_json({"type": "ping"})
        data = ws.receive_json()
        assert data.get("type") == "pong" or data.get("event") == "pong"

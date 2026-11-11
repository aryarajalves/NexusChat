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


def test_user_websocket_disconnect_cleans_voice_rooms():
    """Valida que desconectar o WebSocket global remove o usuário de todas as salas de voz se ele não tiver outros sockets."""
    from app.services.socket_manager import socket_manager
    headers = get_auth_headers()
    token = headers["Authorization"].replace("Bearer ", "")

    voice_ch_id = 7777
    with client.websocket_connect(f"/api/v1/discord/ws/me?token={token}") as ws:
        # Usuário registra presença em sala de voz enquanto está conectado
        socket_manager.register_voice_user(voice_ch_id, 1, "Super Admin")
        assert 1 in socket_manager.voice_rooms.get(voice_ch_id, {})
        assert socket_manager.is_user_online(1) is True

    # Ao desconectar do /ws/me (e sem outros sockets), deve ter saído da sala de voz
    assert voice_ch_id not in socket_manager.voice_rooms or 1 not in socket_manager.voice_rooms.get(voice_ch_id, {})
    assert socket_manager.is_user_online(1) is False


def test_user_websocket_new_session_terminates_previous_session():
    """Valida que quando uma nova aba/sessão conecta, a sessão antiga recebe aviso de término e é encerrada."""
    headers = get_auth_headers()
    token = headers["Authorization"].replace("Bearer ", "")

    with client.websocket_connect(f"/api/v1/discord/ws/me?token={token}&session_id=session_aba_1") as ws_aba_1:
        # Nova aba conecta com session_id diferente
        with client.websocket_connect(f"/api/v1/discord/ws/me?token={token}&session_id=session_aba_2") as ws_aba_2:
            # A aba 1 deve receber o evento de sessão terminada
            term_event = ws_aba_1.receive_json()
            assert term_event["event"] == "session:terminated"
            assert term_event["reason"] == "new_login"
            assert "outra aba" in term_event["detail"]


def test_login_endpoint_notifies_active_websockets():
    """Valida que ao realizar novo login via REST, conexões WebSocket anteriores recebem evento de término de sessão."""
    from app.core.config import settings
    headers = get_auth_headers()
    token = headers["Authorization"].replace("Bearer ", "")

    with client.websocket_connect(f"/api/v1/discord/ws/me?token={token}&session_id=sess_ativa") as ws:
        # Outra aba/dispositivo realiza login com as mesmas credenciais
        res = client.post("/api/v1/auth/login", json={"email": settings.SUPERADMIN_EMAIL, "password": settings.SUPERADMIN_PASSWORD})
        assert res.status_code == 200

        msg = ws.receive_json()
        assert msg["event"] == "session:terminated"
        assert msg["reason"] == "new_login"


def test_obsolete_token_rejected_and_cannot_terminate_new_session():
    """Valida que um token antigo/revogado é rejeitado e não consegue derrubar a sessão mais recente."""
    from app.core.config import settings
    from app.services.socket_manager import socket_manager

    # 1. Login inicial (aba 1)
    res1 = client.post("/api/v1/auth/login", json={"email": settings.SUPERADMIN_EMAIL, "password": settings.SUPERADMIN_PASSWORD})
    old_token = res1.json()["access_token"]

    # 2. Novo login posterior (aba 2)
    res2 = client.post("/api/v1/auth/login", json={"email": settings.SUPERADMIN_EMAIL, "password": settings.SUPERADMIN_PASSWORD})
    new_token = res2.json()["access_token"]

    # 3. Aba 2 conecta com sucesso com seu token recente
    with client.websocket_connect(f"/api/v1/discord/ws/me?token={new_token}&session_id=sess_nova") as ws_new:
        ws_new.send_json({"type": "ping"})
        pong = ws_new.receive_json()
        assert pong.get("type") == "pong" or pong.get("event") == "pong"

        # 4. Aba 1 tenta reconectar usando o token obsoleto
        with pytest.raises(Exception):
            with client.websocket_connect(f"/api/v1/discord/ws/me?token={old_token}&session_id=sess_antiga") as ws_old:
                pass

        # 5. A aba 2 permanece ativa e intacta (não foi desconectada pelo token antigo)
        ws_new.send_json({"type": "ping"})
        pong2 = ws_new.receive_json()
        assert pong2.get("type") == "pong" or pong2.get("event") == "pong"


def test_websocket_does_not_hold_db_connections_in_pool():
    """Valida que manter um WebSocket conectado não deixa conexões checkedout no pool do banco de dados."""
    from app.core.database import engine

    headers = get_auth_headers()
    token = headers["Authorization"].replace("Bearer ", "")

    initial_checked_out = engine.pool.checkedout() if hasattr(engine, "pool") else 0

    with client.websocket_connect(f"/api/v1/discord/ws/me?token={token}&session_id=sess_zero_leak") as ws:
        ws.send_json({"type": "ping"})
        data = ws.receive_json()
        assert data.get("type") == "pong" or data.get("event") == "pong"

        # Enquanto o WebSocket está aberto e ativo, nenhuma conexão de banco deve estar presa
        current_checked_out = engine.pool.checkedout() if hasattr(engine, "pool") else 0
        assert current_checked_out <= initial_checked_out





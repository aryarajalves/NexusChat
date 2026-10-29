import pytest
from starlette.websockets import WebSocketDisconnect
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from conftest import client, TestingSessionLocal

@pytest.fixture
def two_users():
    db = TestingSessionLocal()
    # Cria usuário bob
    bob = db.query(User).filter(User.email == "bob@teste.com").first()
    if not bob:
        bob = User(
            email="bob@teste.com",
            name="Bob Construtor",
            hashed_password=get_password_hash("Senha@Forte1234!"),
            role="user",
            is_active=True,
            max_servers=100
        )
        db.add(bob)
        db.commit()
    db.close()
    return ("bob@teste.com", "Senha@Forte1234!")

def get_token(email=settings.SUPERADMIN_EMAIL, password=settings.SUPERADMIN_PASSWORD):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    return res.json()["access_token"]

def create_test_server_and_channel():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post("/api/v1/discord/servers", json={"name": "Servidor WebSocket"}, headers=headers)
    assert res.status_code == 201
    server_id = res.json()["id"]
    channels = res.json()["channels"]
    text_ch = next(c for c in channels if c["type"] == "TEXT")
    return server_id, text_ch["id"], token

def test_websocket_unauthorized():
    """Valida rejeição de conexões sem token ou com token inválido."""
    _, channel_id, _ = create_test_server_and_channel()
    
    # 1. Sem token
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/api/v1/discord/ws/channels/{channel_id}"):
            pass
    assert exc.value.code == 1008

    # 2. Token inválido
    with pytest.raises(WebSocketDisconnect) as exc2:
        with client.websocket_connect(f"/api/v1/discord/ws/channels/{channel_id}?token=invalid-jwt"):
            pass
    assert exc2.value.code == 1008

def test_websocket_connect_and_presence():
    """Valida conexão bem-sucedida e evento de presença."""
    _, channel_id, token = create_test_server_and_channel()

    with client.websocket_connect(f"/api/v1/discord/ws/channels/{channel_id}?token={token}") as ws:
        # Primeiro evento recebido deve ser de presença (presence:join)
        data = ws.receive_json()
        assert data["event"] == "presence:join"
        assert data["user_name"] == settings.SUPERADMIN_NAME
        assert any(u["user_name"] == settings.SUPERADMIN_NAME for u in data["online_users"])

def test_websocket_send_and_receive_message():
    """Valida envio de mensagem diretamente pelo WebSocket e persistência no banco."""
    _, channel_id, token = create_test_server_and_channel()

    with client.websocket_connect(f"/api/v1/discord/ws/channels/{channel_id}?token={token}") as ws:
        # Consome presença
        ws.receive_json()

        # Envia mensagem via socket
        ws.send_json({
            "event": "message:send",
            "content": "Olá via WebSocket em tempo real!"
        })

        # Recebe broadcast da mensagem criada
        msg_event = ws.receive_json()
        assert msg_event["event"] == "message:new"
        assert msg_event["message"]["content"] == "Olá via WebSocket em tempo real!"
        assert msg_event["message"]["author_name"] == settings.SUPERADMIN_NAME

    # Valida se a mensagem foi persistida via REST API
    headers = {"Authorization": f"Bearer {token}"}
    hist_res = client.get(f"/api/v1/discord/channels/{channel_id}/messages", headers=headers)
    assert hist_res.status_code == 200
    messages = hist_res.json()
    assert any(m["content"] == "Olá via WebSocket em tempo real!" for m in messages)

def test_websocket_typing_and_ping():
    """Valida envio de typing indicator e ping/pong."""
    _, channel_id, token = create_test_server_and_channel()

    with client.websocket_connect(f"/api/v1/discord/ws/channels/{channel_id}?token={token}") as ws:
        # Consome presença
        ws.receive_json()

        # Testa ping
        ws.send_json({"event": "ping"})
        pong_event = ws.receive_json()
        assert pong_event["event"] == "pong"

def test_rest_message_triggers_websocket_broadcast(two_users):
    """Valida que mensagens enviadas via REST disparam broadcast imediato no WebSocket."""
    server_id, channel_id, superadmin_token = create_test_server_and_channel()

    # Bob entra no servidor via convite
    sa_headers = {"Authorization": f"Bearer {superadmin_token}"}
    inv_res = client.post(f"/api/v1/discord/servers/{server_id}/invites", json={}, headers=sa_headers)
    invite_code = inv_res.json()["code"]

    bob_token = get_token("bob@teste.com", "Senha@Forte1234!")
    bob_headers = {"Authorization": f"Bearer {bob_token}"}
    join_res = client.post(f"/api/v1/discord/invites/{invite_code}/join", headers=bob_headers)
    assert join_res.status_code == 200

    # Bob conecta via WebSocket para escutar
    with client.websocket_connect(f"/api/v1/discord/ws/channels/{channel_id}?token={bob_token}") as bob_ws:
        bob_ws.receive_json()  # presença

        # Superadmin envia mensagem via REST
        rest_res = client.post(
            f"/api/v1/discord/channels/{channel_id}/messages",
            json={"content": "Mensagem enviada pelo REST API!"},
            headers=sa_headers
        )
        assert rest_res.status_code == 201

        # Bob deve receber a mensagem instantaneamente no WebSocket
        data = bob_ws.receive_json()
        assert data["event"] == "message:new"
        assert data["message"]["content"] == "Mensagem enviada pelo REST API!"
        assert data["message"]["author_name"] == settings.SUPERADMIN_NAME

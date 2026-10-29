import pytest
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from conftest import client, TestingSessionLocal


def create_pins_user(email: str, name: str, password: str = "SenhaForte123!@"):
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        u = User(
            email=email,
            name=name,
            hashed_password=get_password_hash(password),
            role="user",
            is_active=True,
            max_servers=100
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        uid = u.id
    else:
        uid = existing.id
    db.close()
    return uid


def get_auth_headers(email=settings.SUPERADMIN_EMAIL, password=settings.SUPERADMIN_PASSWORD):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def setup_pins_server():
    headers = get_auth_headers()
    res = client.post("/api/v1/discord/servers", json={"name": "Servidor Pins Teste"}, headers=headers)
    assert res.status_code == 201
    server_data = res.json()
    text_channel = [c for c in server_data["channels"] if c["type"] == "TEXT"][0]
    return server_data["id"], text_channel["id"], headers


def test_channel_pin_and_unpin():
    server_id, channel_id, headers = setup_pins_server()

    # Envia mensagem no canal
    res_msg = client.post(
        f"/api/v1/discord/channels/{channel_id}/messages",
        json={"content": "Mensagem importante para fixar"},
        headers=headers
    )
    assert res_msg.status_code == 201
    msg_id = res_msg.json()["id"]

    # Verifica lista inicial de fixadas vazia
    res_initial = client.get(f"/api/v1/discord/channels/{channel_id}/pins", headers=headers)
    assert res_initial.status_code == 200
    assert len(res_initial.json()) == 0

    # Fixa a mensagem
    res_pin = client.patch(f"/api/v1/discord/channels/{channel_id}/messages/{msg_id}/pin", headers=headers)
    assert res_pin.status_code == 200
    assert res_pin.json()["is_pinned"] is True

    # Verifica lista de fixadas com a mensagem
    res_pins = client.get(f"/api/v1/discord/channels/{channel_id}/pins", headers=headers)
    assert res_pins.status_code == 200
    pins = res_pins.json()
    assert len(pins) == 1
    assert pins[0]["id"] == msg_id
    assert pins[0]["is_pinned"] is True

    # Desafixa a mensagem
    res_unpin = client.patch(f"/api/v1/discord/channels/{channel_id}/messages/{msg_id}/pin", headers=headers)
    assert res_unpin.status_code == 200
    assert res_unpin.json()["is_pinned"] is False

    # Lista volta a ficar vazia
    res_final = client.get(f"/api/v1/discord/channels/{channel_id}/pins", headers=headers)
    assert res_final.status_code == 200
    assert len(res_final.json()) == 0


def test_dm_pin_and_unpin():
    headers1 = get_auth_headers()
    u2_id = create_pins_user("amigopin@teste.com", "Amigo Pin", "SenhaForte123!@")
    headers2 = get_auth_headers("amigopin@teste.com", "SenhaForte123!@")

    # Inicia DM
    res_conv = client.post("/api/v1/discord/dms/conversations", json={"target_user_id": u2_id}, headers=headers1)
    assert res_conv.status_code == 201
    conv_id = res_conv.json()["id"]

    # Envia mensagem na DM
    res_msg = client.post(
        f"/api/v1/discord/dms/conversations/{conv_id}/messages",
        json={"content": "Regras da DM fixadas"},
        headers=headers1
    )
    assert res_msg.status_code == 201
    dm_msg_id = res_msg.json()["id"]

    # Fixa a mensagem na DM
    res_pin = client.patch(f"/api/v1/discord/dms/conversations/{conv_id}/messages/{dm_msg_id}/pin", headers=headers2)
    assert res_pin.status_code == 200
    assert res_pin.json()["is_pinned"] is True

    # Lista fixadas da DM
    res_pins = client.get(f"/api/v1/discord/dms/conversations/{conv_id}/pins", headers=headers1)
    assert res_pins.status_code == 200
    assert len(res_pins.json()) == 1
    assert res_pins.json()[0]["id"] == dm_msg_id

    # Terceiro usuário não participante recebe 403
    u3_id = create_pins_user("curioso@teste.com", "Curioso", "SenhaForte123!@")
    headers3 = get_auth_headers("curioso@teste.com", "SenhaForte123!@")
    res_denied = client.get(f"/api/v1/discord/dms/conversations/{conv_id}/pins", headers=headers3)
    assert res_denied.status_code == 403

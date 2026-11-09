import io
import pytest
from app.core.config import settings
from conftest import client

def get_auth_token():
    res = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    return res.json()["access_token"]

def test_user_profile_update():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Obter perfil atual
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    original_name = me_res.json()["name"]

    # 2. Atualizar perfil
    update_res = client.patch(
        "/api/v1/auth/profile",
        json={"name": "Super Admin Custom", "avatar_url": "/api/v1/discord/attachments/avatar_test.png"},
        headers=headers
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Super Admin Custom"
    assert update_res.json()["avatar_url"] == "/api/v1/discord/attachments/avatar_test.png"

    # Restaura nome original
    client.patch("/api/v1/auth/profile", json={"name": original_name, "avatar_url": None}, headers=headers)

def test_user_avatar_upload():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    fake_png = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
    res = client.post(
        "/api/v1/auth/avatar",
        files={"file": ("user_avatar.png", fake_png, "image/png")},
        headers=headers
    )
    assert res.status_code == 200
    assert "avatar_url" in res.json()
    assert res.json()["avatar_url"].startswith("/api/v1/discord/attachments/avatar_")

def test_change_password_flow():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Senha atual incorreta
    wrong_res = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "SenhaErradaIncorreta123!", "new_password": "NovaSenhaSegura123!"},
        headers=headers
    )
    assert wrong_res.status_code == 400
    assert "incorreta" in wrong_res.json()["detail"].lower()

    # 2. Nova senha fraca (menos de 12 caracteres)
    weak_res = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": settings.SUPERADMIN_PASSWORD, "new_password": "Fraca1!"},
        headers=headers
    )
    assert weak_res.status_code == 422


def test_user_profile_and_avatar_realtime_broadcast():
    """Garante que trocar a foto de perfil ou nome propaga user:profile_updated em tempo real no WebSocket /ws/me e atualiza voice_rooms."""
    from app.services.socket_manager import socket_manager

    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/auth/me", headers=headers).json()
    user_id = me["id"]
    original_name = me["name"]

    # Registra o usuário em uma sala de voz ativa
    socket_manager.register_voice_user(999, user_id, original_name, avatar_url=None)

    with client.websocket_connect(f"/api/v1/discord/ws/me?token={token}") as ws:
        # Atualiza avatar e nome no perfil
        new_avatar = "/api/v1/discord/attachments/avatar_realtime_test.png"
        update_res = client.patch(
            "/api/v1/auth/profile",
            json={"name": "Hokage Atualizado", "avatar_url": new_avatar},
            headers=headers,
        )
        assert update_res.status_code == 200

        # Recebe eventos WebSocket em tempo real
        received_events = []
        for _ in range(2):
            received_events.append(ws.receive_json())

        profile_ev = next((e for e in received_events if e.get("event") == "user:profile_updated"), None)
        assert profile_ev is not None
        assert profile_ev["user_id"] == user_id
        assert profile_ev["name"] == "Hokage Atualizado"
        assert profile_ev["avatar_url"] == new_avatar

        voice_ev = next((e for e in received_events if e.get("event") == "voice:channel_update"), None)
        assert voice_ev is not None
        assert voice_ev["channel_id"] == 999
        participant = next((p for p in voice_ev["active_participants"] if p["user_id"] == user_id), None)
        assert participant is not None
        assert participant["avatar_url"] == new_avatar
        assert participant["user_name"] == "Hokage Atualizado"

    # Limpa estado
    socket_manager.unregister_voice_user(999, user_id)
    client.patch("/api/v1/auth/profile", json={"name": original_name, "avatar_url": None}, headers=headers)

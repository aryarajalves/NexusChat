import pytest
from jose import jwt
from app.core.config import settings
from app.services.livekit_service import (
    generate_livekit_token,
    get_livekit_voice_credentials,
)
from conftest import client, TestingSessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def create_user_helper(email: str, name: str):
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        u = User(
            email=email,
            name=name,
            hashed_password=get_password_hash("SenhaForte123!@"),
            role="user",
            is_active=True,
            max_servers=100,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        uid = u.id
    else:
        uid = existing.id
    db.close()
    return uid

def get_auth_token(email: str):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "SenhaForte123!@"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_generate_livekit_token_structure():
    """Valida que o token gerado segue a especificação oficial de JWT do LiveKit SFU."""
    token = generate_livekit_token(channel_id=99, user_id=10, user_name="Alice")
    assert token is not None

    decoded = jwt.decode(token, settings.LIVEKIT_API_SECRET, algorithms=["HS256"])
    assert decoded["iss"] == settings.LIVEKIT_API_KEY
    assert decoded["sub"] == "user_10"
    assert decoded["name"] == "Alice"
    assert decoded["video"]["room"] == "channel_99"
    assert decoded["video"]["roomJoin"] is True
    assert decoded["video"]["canPublish"] is True
    assert decoded["video"]["canSubscribe"] is True

def test_get_livekit_voice_credentials():
    """Valida payload retornado pelo helper de credenciais."""
    creds = get_livekit_voice_credentials(channel_id=45, user_id=3, user_name="Bob")
    assert creds["livekit_url"] == settings.LIVEKIT_URL
    assert "token" in creds
    assert creds["room_name"] == "channel_45"
    assert creds["participant_identity"] == "user_3"
    assert creds["is_sfu_available"] is True

def test_api_voice_token_endpoint():
    """Valida emissão de token via endpoint REST para canal VOICE."""
    user_email = "voice_sfu_user@teste.com"
    create_user_helper(user_email, "Voice Master")
    headers = get_auth_token(user_email)

    # 1. Cria servidor
    res_srv = client.post("/api/v1/discord/servers", json={"name": "Servidor LiveKit SFU"}, headers=headers)
    assert res_srv.status_code == 201
    srv_data = res_srv.json()
    srv_id = srv_data["id"]

    # 2. Cria canal de voz
    res_voice_ch = client.post(
        f"/api/v1/discord/servers/{srv_id}/channels",
        json={"name": "sala-ao-vivo", "type": "VOICE"},
        headers=headers
    )
    assert res_voice_ch.status_code == 201
    voice_ch_id = res_voice_ch.json()["id"]

    # 3. Solicita token SFU
    res_token = client.post(f"/api/v1/discord/channels/{voice_ch_id}/voice-token", headers=headers)
    assert res_token.status_code == 200
    data = res_token.json()
    assert "token" in data
    assert data["room_name"] == f"channel_{voice_ch_id}"
    assert data["server_id"] == srv_id

    # 4. Status da sala
    res_status = client.get(f"/api/v1/discord/channels/{voice_ch_id}/voice-status", headers=headers)
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["channel_id"] == voice_ch_id
    assert status_data["sfu_enabled"] is True

def test_api_voice_token_rejects_text_channel():
    """Garante que canais de texto não permitem emissão de tokens de voz."""
    user_email = "text_reject_user@teste.com"
    create_user_helper(user_email, "Text User")
    headers = get_auth_token(user_email)

    res_srv = client.post("/api/v1/discord/servers", json={"name": "Servidor Text Reject"}, headers=headers)
    srv_data = res_srv.json()
    text_channel = [c for c in srv_data["channels"] if c["type"] == "TEXT"][0]

    res_token = client.post(f"/api/v1/discord/channels/{text_channel['id']}/voice-token", headers=headers)
    assert res_token.status_code == 400
    assert "exclusivo para canais de voz" in res_token.json()["detail"]

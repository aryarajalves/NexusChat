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
from app.services.socket_manager import socket_manager

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

def test_api_voice_join_leave_presence():
    """Valida registro e remoção de presença de múltiplos usuários no canal de voz."""
    user1_email = "voice_user1@teste.com"
    user2_email = "voice_user2@teste.com"
    uid1 = create_user_helper(user1_email, "User Um")
    uid2 = create_user_helper(user2_email, "User Dois")
    h1 = get_auth_token(user1_email)
    h2 = get_auth_token(user2_email)

    # Cria servidor pelo user 1
    res_srv = client.post("/api/v1/discord/servers", json={"name": "Servidor Multiusuário Voz"}, headers=h1)
    assert res_srv.status_code == 201
    srv_id = res_srv.json()["id"]

    # Cria canal de voz
    res_vch = client.post(f"/api/v1/discord/servers/{srv_id}/channels", json={"name": "call-geral", "type": "VOICE"}, headers=h1)
    assert res_vch.status_code == 201
    vch_id = res_vch.json()["id"]

    # User 2 entra no servidor
    res_invite = client.post(f"/api/v1/discord/servers/{srv_id}/invites", headers=h1)
    inv_code = res_invite.json()["code"]
    client.post(f"/api/v1/discord/invites/{inv_code}/join", headers=h2)

    # 1. User 1 entra na sala de voz
    join1 = client.post(f"/api/v1/discord/channels/{vch_id}/voice-join", headers=h1)
    assert join1.status_code == 200
    assert join1.json()["total_participants"] == 1

    # 2. User 2 entra na sala de voz
    join2 = client.post(f"/api/v1/discord/channels/{vch_id}/voice-join", headers=h2)
    assert join2.status_code == 200
    assert join2.json()["total_participants"] == 2

    # 3. Status da sala deve listar ambos os 2 usuários com seus estados de voz
    status_res = client.get(f"/api/v1/discord/channels/{vch_id}/voice-status", headers=h1)
    assert status_res.status_code == 200
    participants = status_res.json()["active_participants"]
    assert len(participants) == 2
    uids = [p["user_id"] for p in participants]
    assert uid1 in uids
    assert uid2 in uids
    assert "voice_states" in status_res.json()
    assert str(uid1) in status_res.json()["voice_states"]
    assert status_res.json()["voice_states"][str(uid1)]["is_muted"] is True

    # Atualiza o estado de voz e verifica sincronização
    socket_manager.update_voice_user_state(vch_id, uid2, is_muted=False, is_deafened=False)
    status_updated = client.get(f"/api/v1/discord/channels/{vch_id}/voice-status", headers=h1)
    assert status_updated.json()["voice_states"][str(uid2)]["is_muted"] is False

    # 4. User 1 sai da sala de voz
    leave1 = client.post(f"/api/v1/discord/channels/{vch_id}/voice-leave", headers=h1)
    assert leave1.status_code == 200
    assert leave1.json()["total_participants"] == 1

    # Status deve ter apenas User 2
    status_res2 = client.get(f"/api/v1/discord/channels/{vch_id}/voice-status", headers=h2)
    assert status_res2.status_code == 200
    participants2 = status_res2.json()["active_participants"]
    assert len(participants2) == 1
    assert participants2[0]["user_id"] == uid2


def test_voice_call_timer_persistence_and_reset():
    """
    Testa se o cronômetro da call:
    1. Inicia quando o primeiro usuário entra.
    2. Persiste o mesmo timestamp quando outros entram ou saem (desde que reste ao menos 1 pessoa).
    3. Reseta para None apenas quando todos os participantes saírem da call.
    """
    user1_email = "timer_user1@teste.com"
    user2_email = "timer_user2@teste.com"
    create_user_helper(user1_email, "Timer User Um")
    create_user_helper(user2_email, "Timer User Dois")
    h1 = get_auth_token(user1_email)
    h2 = get_auth_token(user2_email)

    # 1. Cria servidor e canal de voz
    res_srv = client.post("/api/v1/discord/servers", json={"name": "Servidor Timer Test"}, headers=h1)
    assert res_srv.status_code == 201
    srv_id = res_srv.json()["id"]

    res_vch = client.post(f"/api/v1/discord/servers/{srv_id}/channels", json={"name": "call-timer", "type": "VOICE"}, headers=h1)
    assert res_vch.status_code == 201
    vch_id = res_vch.json()["id"]

    # User 2 entra no servidor
    res_inv = client.post(f"/api/v1/discord/servers/{srv_id}/invites", headers=h1)
    client.post(f"/api/v1/discord/invites/{res_inv.json()['code']}/join", headers=h2)

    # Canal vazio -> call_started_at é None
    initial_status = client.get(f"/api/v1/discord/channels/{vch_id}/voice-status", headers=h1).json()
    assert initial_status["call_started_at"] is None
    assert initial_status["total_participants"] == 0

    # User 1 entra -> cronômetro inicia
    join1 = client.post(f"/api/v1/discord/channels/{vch_id}/voice-join", headers=h1).json()
    start_time_1 = join1["call_started_at"]
    assert start_time_1 is not None
    assert isinstance(start_time_1, (int, float))

    # User 2 entra -> mesmo start_time é mantido (não reseta)
    join2 = client.post(f"/api/v1/discord/channels/{vch_id}/voice-join", headers=h2).json()
    assert join2["call_started_at"] == start_time_1

    # User 1 sai, User 2 continua na call -> cronômetro continua ativo com o mesmo início
    leave1 = client.post(f"/api/v1/discord/channels/{vch_id}/voice-leave", headers=h1).json()
    assert leave1["total_participants"] == 1
    assert leave1["call_started_at"] == start_time_1

    # User 2 sai -> canal fica vazio e cronômetro reseta para None
    leave2 = client.post(f"/api/v1/discord/channels/{vch_id}/voice-leave", headers=h2).json()
    assert leave2["total_participants"] == 0
    assert leave2["call_started_at"] is None

    # Status confirma reset para None
    status_empty = client.get(f"/api/v1/discord/channels/{vch_id}/voice-status", headers=h1).json()
    assert status_empty["call_started_at"] is None


def test_switching_voice_channels_removes_user_from_previous_channel():
    """
    Garante a regra do Discord de que um usuário não pode estar em dois canais de voz simultaneamente.
    Ao entrar em um novo canal de voz, o usuário deve ser automaticamente desvinculado do canal anterior.
    """
    user_email = "switch_voice_user@teste.com"
    create_user_helper(user_email, "Switch User")
    headers = get_auth_token(user_email)

    # 1. Cria servidor
    res_srv = client.post("/api/v1/discord/servers", json={"name": "Servidor Switch Voice"}, headers=headers)
    assert res_srv.status_code == 201
    srv_id = res_srv.json()["id"]

    # 2. Cria dois canais de voz no mesmo servidor
    res_ch_a = client.post(
        f"/api/v1/discord/servers/{srv_id}/channels",
        json={"name": "sala-voz-a", "type": "VOICE"},
        headers=headers
    )
    ch_a_id = res_ch_a.json()["id"]

    res_ch_b = client.post(
        f"/api/v1/discord/servers/{srv_id}/channels",
        json={"name": "sala-voz-b", "type": "VOICE"},
        headers=headers
    )
    ch_b_id = res_ch_b.json()["id"]

    # 3. Usuário entra na Sala A
    res_join_a = client.post(f"/api/v1/discord/channels/{ch_a_id}/voice-join", headers=headers)
    assert res_join_a.status_code == 200
    assert res_join_a.json()["total_participants"] == 1

    # Verifica status: Sala A tem 1, Sala B tem 0
    status_a = client.get(f"/api/v1/discord/channels/{ch_a_id}/voice-status", headers=headers).json()
    status_b = client.get(f"/api/v1/discord/channels/{ch_b_id}/voice-status", headers=headers).json()
    assert status_a["total_participants"] == 1
    assert status_b["total_participants"] == 0

    # 4. Usuário agora entra na Sala B diretamente (switch)
    res_join_b = client.post(f"/api/v1/discord/channels/{ch_b_id}/voice-join", headers=headers)
    assert res_join_b.status_code == 200
    assert res_join_b.json()["total_participants"] == 1

    # 5. Verifica que o usuário SAIU automaticamente da Sala A e agora está APENAS na Sala B
    status_a_after = client.get(f"/api/v1/discord/channels/{ch_a_id}/voice-status", headers=headers).json()
    status_b_after = client.get(f"/api/v1/discord/channels/{ch_b_id}/voice-status", headers=headers).json()

    assert status_a_after["total_participants"] == 0, "Usuário duplicado! Deveria ter saído da Sala A."
    assert status_b_after["total_participants"] == 1, "Usuário deveria estar presente na Sala B."


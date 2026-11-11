import pytest
from conftest import client, TestingSessionLocal
from app.models.user import User
from app.models.discord import Channel, Server, ServerMember, ServerRole
from app.core.security import get_password_hash
from app.services.socket_manager import socket_manager


def create_user_helper(email: str, name: str, role: str = "user"):
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        u = User(
            email=email,
            name=name,
            hashed_password=get_password_hash("SenhaForte123!@"),
            role=role,
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


def test_create_and_manage_stage_channel():
    """Valida o fluxo completo de canal de palco (STAGE): criação, levantar a mão e concessão de palavra."""
    prof_email = "professor_stage_test@teste.com"
    aluno_email = "aluno_stage_test@teste.com"
    prof_id = create_user_helper(prof_email, "Prof. Gilberto")
    aluno_id = create_user_helper(aluno_email, "Aluno Carlinhos")

    prof_h = get_auth_token(prof_email)
    aluno_h = get_auth_token(aluno_email)

    # 1. Cria servidor pelo professor (dono/moderador)
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Faculdade"}, headers=prof_h)
    assert srv_res.status_code == 201
    srv_id = srv_res.json()["id"]

    # 2. Adiciona o aluno ao servidor
    inv_res = client.post(f"/api/v1/discord/servers/{srv_id}/invites", headers=prof_h)
    assert inv_res.status_code == 201
    inv_code = inv_res.json()["code"]

    join_res = client.post(f"/api/v1/discord/invites/{inv_code}/join", headers=aluno_h)
    assert join_res.status_code == 200

    # 3. Cria canal do tipo STAGE
    ch_res = client.post(
        f"/api/v1/discord/servers/{srv_id}/channels",
        json={"name": "aula-matematica", "type": "STAGE", "category": "Canais de Aula"},
        headers=prof_h
    )
    assert ch_res.status_code == 201
    stage_ch = ch_res.json()
    assert stage_ch["type"] == "STAGE"
    ch_id = stage_ch["id"]

    # 4. Professor gera token de voz e valida privilégios de moderador/orador
    prof_token_res = client.post(f"/api/v1/discord/channels/{ch_id}/voice-token", headers=prof_h)
    assert prof_token_res.status_code == 200
    prof_data = prof_token_res.json()
    assert prof_data["is_stage"] is True
    assert prof_data["is_moderator"] is True
    assert prof_data["is_speaker"] is True

    # 5. Aluno gera token de voz e entra como ouvinte
    aluno_token_res = client.post(f"/api/v1/discord/channels/{ch_id}/voice-token", headers=aluno_h)
    assert aluno_token_res.status_code == 200
    aluno_data = aluno_token_res.json()
    assert aluno_data["is_stage"] is True
    assert aluno_data["is_moderator"] is False
    assert aluno_data["is_speaker"] is False

    # 6. Aluno levanta a mão para pedir para falar
    hand_res = client.post(
        f"/api/v1/discord/channels/{ch_id}/stage/raise-hand",
        json={"hand_raised": True},
        headers=aluno_h
    )
    assert hand_res.status_code == 200
    assert hand_res.json()["hand_raised"] is True
    assert aluno_id in hand_res.json()["hands_raised"]

    # 7. Aluno não-moderador tenta conceder palavra (deve ser bloqueado com 403)
    hack_res = client.post(
        f"/api/v1/discord/channels/{ch_id}/stage/grant-speak",
        json={"target_user_id": aluno_id},
        headers=aluno_h
    )
    assert hack_res.status_code == 403

    # 8. Professor visualiza status do palco com a mão do aluno levantada
    status_res = client.get(f"/api/v1/discord/channels/{ch_id}/stage/status", headers=prof_h)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["is_stage"] is True
    assert aluno_id in status_data["hands_raised"]

    # 9. Professor concede a palavra ao aluno
    grant_res = client.post(
        f"/api/v1/discord/channels/{ch_id}/stage/grant-speak",
        json={"target_user_id": aluno_id},
        headers=prof_h
    )
    assert grant_res.status_code == 200
    assert aluno_id in grant_res.json()["speakers"]
    assert aluno_id not in grant_res.json()["hands_raised"]

    # 10. Aluno verifica status de voz e confirma que agora é orador (is_speaker=True)
    aluno_token_res2 = client.post(f"/api/v1/discord/channels/{ch_id}/voice-token", headers=aluno_h)
    assert aluno_token_res2.status_code == 200
    assert aluno_token_res2.json()["is_speaker"] is True

    # 11. Professor revoga a palavra do aluno (muta o aluno)
    revoke_res = client.post(
        f"/api/v1/discord/channels/{ch_id}/stage/revoke-speak",
        json={"target_user_id": aluno_id},
        headers=prof_h
    )
    assert revoke_res.status_code == 200
    assert aluno_id not in revoke_res.json()["speakers"]


def test_role_with_stage_moderation_permission():
    """Valida que cargo com can_moderate_stage=True concede privilégio de orador e moderação."""
    owner_email = "owner_stage_role@teste.com"
    tutor_email = "tutor_stage_role@teste.com"
    owner_id = create_user_helper(owner_email, "Diretor Geral")
    tutor_id = create_user_helper(tutor_email, "Tutor Pedro")

    owner_h = get_auth_token(owner_email)
    tutor_h = get_auth_token(tutor_email)

    srv_res = client.post("/api/v1/discord/servers", json={"name": "Colegio Modelo"}, headers=owner_h)
    srv_id = srv_res.json()["id"]

    inv_code = client.post(f"/api/v1/discord/servers/{srv_id}/invites", headers=owner_h).json()["code"]
    client.post(f"/api/v1/discord/invites/{inv_code}/join", headers=tutor_h)

    # Cria cargo com can_moderate_stage=True
    role_res = client.post(
        f"/api/v1/discord/servers/{srv_id}/roles",
        json={"name": "Monitor de Sala", "color": "#1abc9c", "can_moderate_stage": True},
        headers=owner_h
    )
    assert role_res.status_code == 201
    role_id = role_res.json()["id"]
    assert role_res.json()["can_moderate_stage"] is True

    # Atribui o cargo ao tutor
    members = client.get(f"/api/v1/discord/servers/{srv_id}/members", headers=owner_h).json()
    tutor_member = next(m for m in members if m["user_id"] == tutor_id)
    assign_res = client.patch(
        f"/api/v1/discord/servers/{srv_id}/members/{tutor_member['id']}/role",
        json={"role_id": role_id},
        headers=owner_h
    )
    assert assign_res.status_code == 200

    # Cria canal STAGE
    ch_id = client.post(
        f"/api/v1/discord/servers/{srv_id}/channels",
        json={"name": "palestra-inaugural", "type": "STAGE"},
        headers=owner_h
    ).json()["id"]

    # Tutor entra no canal de palco e tem poderes de moderador
    tutor_token_res = client.post(f"/api/v1/discord/channels/{ch_id}/voice-token", headers=tutor_h)
    assert tutor_token_res.status_code == 200
    assert tutor_token_res.json()["is_moderator"] is True
    assert tutor_token_res.json()["is_speaker"] is True

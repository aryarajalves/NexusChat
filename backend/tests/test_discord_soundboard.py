"""
Testes unitários para o Módulo de Soundboard na Sala de Voz.
"""
import io
import pytest
from conftest import client, TestingSessionLocal
from app.models.user import User
from app.models.discord import Server, ServerMember, Channel
from app.core.security import get_password_hash


def create_user_helper(email: str, name: str, role: str = "user") -> int:
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
        existing.role = role
        db.commit()
        uid = existing.id
    db.close()
    return uid


def get_auth_token(email: str):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "SenhaForte123!@"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def setup_server_soundboard_scenario():
    """Cria um servidor com 1 Dono, 1 Membro comum e 1 Canal de Voz."""
    db = TestingSessionLocal()
    owner_id = create_user_helper("owner_sound@teste.com", "Sound Owner", "user")
    member_id = create_user_helper("member_sound@teste.com", "Sound Member", "user")

    server = Server(name="Servidor Soundboard Test", owner_id=owner_id)
    db.add(server)
    db.commit()
    db.refresh(server)

    db.add(ServerMember(server_id=server.id, user_id=owner_id, role="OWNER"))
    db.add(ServerMember(server_id=server.id, user_id=member_id, role="MEMBER"))
    
    channel = Channel(server_id=server.id, name="Sala de Voz Test", type="VOICE")
    db.add(channel)
    db.commit()
    db.refresh(channel)

    data = {
        "server_id": server.id,
        "channel_id": channel.id,
        "owner_id": owner_id,
        "member_id": member_id,
    }
    db.close()
    return data


def test_upload_and_list_soundboard_sounds(setup_server_soundboard_scenario):
    """Testa upload de som de soundboard por admin e listagem no servidor."""
    data = setup_server_soundboard_scenario
    server_id = data["server_id"]
    headers = get_auth_token("owner_sound@teste.com")

    # Arquivo de áudio simulado
    fake_audio = io.BytesIO(b"ID3\x03\x00\x00\x00\x00\x00#TSSE\x00\x00\x00\x0f\x00\x00\x03Lavf58.76.100")
    files = {"file": ("airhorn.mp3", fake_audio, "audio/mpeg")}
    payload = {"name": "airhorn", "emoji": "📢", "volume": "0.8"}

    res = client.post(
        f"/api/v1/discord/servers/{server_id}/soundboard",
        headers=headers,
        data=payload,
        files=files,
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "airhorn"
    assert body["emoji"] == "📢"
    assert body["volume"] == 0.8
    assert "audio_url" in body
    sound_id = body["id"]

    # Listar sons
    res_list = client.get(f"/api/v1/discord/servers/{server_id}/soundboard", headers=headers)
    assert res_list.status_code == 200
    sounds = res_list.json()
    assert any(s["id"] == sound_id and s["name"] == "airhorn" for s in sounds)


def test_soundboard_duplicate_and_permission_checks(setup_server_soundboard_scenario):
    """Testa bloqueio de duplicidade de nome e negação de permissão para membros comuns."""
    data = setup_server_soundboard_scenario
    server_id = data["server_id"]
    owner_headers = get_auth_token("owner_sound@teste.com")
    member_headers = get_auth_token("member_sound@teste.com")

    # Cadastra o primeiro som
    fake_audio1 = io.BytesIO(b"RIFF....WAVEfmt ....data....")
    client.post(
        f"/api/v1/discord/servers/{server_id}/soundboard",
        headers=owner_headers,
        data={"name": "quack", "emoji": "🦆", "volume": "1.0"},
        files={"file": ("quack.wav", fake_audio1, "audio/wav")},
    )

    # Tenta cadastrar som com mesmo nome (duplicado)
    fake_audio2 = io.BytesIO(b"RIFF....WAVEfmt ....data....")
    res_dup = client.post(
        f"/api/v1/discord/servers/{server_id}/soundboard",
        headers=owner_headers,
        data={"name": "quack", "emoji": "🦆", "volume": "1.0"},
        files={"file": ("quack2.wav", fake_audio2, "audio/wav")},
    )
    assert res_dup.status_code == 400
    assert "Já existe um som com o nome 'quack'" in res_dup.json()["detail"]

    # Tenta cadastrar sendo membro comum
    fake_audio3 = io.BytesIO(b"RIFF....WAVEfmt ....data....")
    res_forbidden = client.post(
        f"/api/v1/discord/servers/{server_id}/soundboard",
        headers=member_headers,
        data={"name": "badumtss", "emoji": "🥁", "volume": "1.0"},
        files={"file": ("badum.wav", fake_audio3, "audio/wav")},
    )
    assert res_forbidden.status_code == 403


def test_soundboard_play_and_delete(setup_server_soundboard_scenario):
    """Testa disparar som no canal de voz e exclusão com sucesso."""
    data = setup_server_soundboard_scenario
    server_id = data["server_id"]
    channel_id = data["channel_id"]
    owner_headers = get_auth_token("owner_sound@teste.com")

    # Upload
    fake_audio = io.BytesIO(b"OggS....")
    res = client.post(
        f"/api/v1/discord/servers/{server_id}/soundboard",
        headers=owner_headers,
        data={"name": "applause", "emoji": "👏", "volume": "0.9"},
        files={"file": ("applause.ogg", fake_audio, "audio/ogg")},
    )
    assert res.status_code == 201
    sound_id = res.json()["id"]

    # Tocar som no canal de voz via endpoint de play
    play_res = client.post(
        f"/api/v1/discord/channels/{channel_id}/soundboard/play",
        headers=owner_headers,
        json={
            "sound_id": sound_id,
            "sound_name": "applause",
            "emoji": "👏",
            "volume": 0.9,
        },
    )
    assert play_res.status_code == 200
    assert "Som reproduzido com sucesso" in play_res.json()["message"]

    # Excluir som
    del_res = client.delete(
        f"/api/v1/discord/servers/{server_id}/soundboard/{sound_id}",
        headers=owner_headers,
    )
    assert del_res.status_code == 200
    assert del_res.json()["message"] == "Som excluído com sucesso."


def test_update_soundboard_sound(setup_server_soundboard_scenario):
    """Testa atualização de nome e emoji do som do soundboard por administrador."""
    data = setup_server_soundboard_scenario
    server_id = data["server_id"]
    owner_headers = get_auth_token("owner_sound@teste.com")
    member_headers = get_auth_token("member_sound@teste.com")

    # 1. Upload do som inicial
    fake_audio = io.BytesIO(b"RIFF....WAVEfmt ")
    res = client.post(
        f"/api/v1/discord/servers/{server_id}/soundboard",
        headers=owner_headers,
        data={"name": "Som Original", "emoji": "📢", "volume": "0.8"},
        files={"file": ("sound.wav", fake_audio, "audio/wav")},
    )
    assert res.status_code == 201
    sound_id = res.json()["id"]

    # 2. Membro comum tenta renomear -> deve ser barrado com 403 Forbidden
    res_forbidden = client.patch(
        f"/api/v1/discord/servers/{server_id}/soundboard/{sound_id}",
        headers=member_headers,
        json={"name": "Tentativa Hacker", "emoji": "💀"},
    )
    assert res_forbidden.status_code == 403

    # 3. Administrador renomeia o som
    res_update = client.patch(
        f"/api/v1/discord/servers/{server_id}/soundboard/{sound_id}",
        headers=owner_headers,
        json={"name": "Som Renomeado", "emoji": "⚡"},
    )
    assert res_update.status_code == 200
    updated_body = res_update.json()
    assert updated_body["name"] == "Som Renomeado"
    assert updated_body["emoji"] == "⚡"

    # 4. Verifica na listagem geral do servidor
    res_list = client.get(f"/api/v1/discord/servers/{server_id}/soundboard", headers=owner_headers)
    assert res_list.status_code == 200
    sound_in_list = next((s for s in res_list.json() if s["id"] == sound_id), None)
    assert sound_in_list is not None
    assert sound_in_list["name"] == "Som Renomeado"
    assert sound_in_list["emoji"] == "⚡"

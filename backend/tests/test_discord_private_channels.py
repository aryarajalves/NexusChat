"""
Testes Unitários: Canais Privados e Restrições por Cargo (Texto e Voz).
"""
import pytest
from app.models.user import User
from app.models.discord import Server, Channel, ServerRole, ServerMember, ChannelRolePermission
from app.core.security import get_password_hash
from conftest import client, TestingSessionLocal

@pytest.fixture
def private_channel_setup():
    """Cria um servidor, cargos (VIP e Admin), dono, membro VIP e membro Comum."""
    db = TestingSessionLocal()
    # Dono do Servidor
    owner = User(
        name="Owner User",
        email="owner_priv@example.com",
        hashed_password=get_password_hash("Password123!@#"),
        is_active=True
    )
    # Membro com cargo VIP
    vip_user = User(
        name="VIP User",
        email="vip_user@example.com",
        hashed_password=get_password_hash("Password123!@#"),
        is_active=True
    )
    # Membro Comum (sem cargo VIP)
    regular_user = User(
        name="Regular User",
        email="regular_user@example.com",
        hashed_password=get_password_hash("Password123!@#"),
        is_active=True
    )
    db.add_all([owner, vip_user, regular_user])
    db.commit()

    # Servidor
    server = Server(
        name="Servidor Teste Privado",
        owner_id=owner.id
    )
    db.add(server)
    db.commit()

    # Cargos
    role_vip = ServerRole(
        server_id=server.id,
        name="VIP",
        color="#f1c40f",
        is_admin=False
    )
    role_admin = ServerRole(
        server_id=server.id,
        name="Admin Server",
        color="#e74c3c",
        is_admin=True
    )
    db.add_all([role_vip, role_admin])
    db.commit()

    # Membros
    m_owner = ServerMember(server_id=server.id, user_id=owner.id, role="OWNER")
    m_vip = ServerMember(server_id=server.id, user_id=vip_user.id, role="MEMBER", role_id=role_vip.id)
    m_regular = ServerMember(server_id=server.id, user_id=regular_user.id, role="MEMBER", role_id=None)
    db.add_all([m_owner, m_vip, m_regular])
    db.commit()

    # Canal Público Padrão
    public_ch = Channel(
        server_id=server.id,
        name="geral",
        type="TEXT",
        category="Canais de Texto",
        is_private=False
    )
    db.add(public_ch)
    db.commit()

    data = {
        "server_id": server.id,
        "owner_id": owner.id,
        "owner_email": owner.email,
        "vip_user_id": vip_user.id,
        "vip_email": vip_user.email,
        "regular_user_id": regular_user.id,
        "regular_email": regular_user.email,
        "role_vip_id": role_vip.id,
        "role_admin_id": role_admin.id,
        "public_ch_id": public_ch.id
    }
    yield data
    db.close()

def get_auth_token(email, password="Password123!@#"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return res.json()["access_token"]

def test_create_private_text_and_voice_channels(private_channel_setup):
    """Valida a criação de canais privados de texto e de voz com restrição de cargos."""
    setup = private_channel_setup
    token = get_auth_token(setup["owner_email"])
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Cria canal de texto privado exclusivo para VIP
    payload_text = {
        "name": "sala-vip",
        "type": "TEXT",
        "category": "Canais de Texto",
        "is_private": True,
        "allowed_role_ids": [setup["role_vip_id"]]
    }
    res_text = client.post(f"/api/v1/discord/servers/{setup['server_id']}/channels", json=payload_text, headers=headers)
    assert res_text.status_code == 201
    data_text = res_text.json()
    assert data_text["name"] == "sala-vip"
    assert data_text["type"] == "TEXT"
    assert data_text["is_private"] is True
    assert data_text["allowed_role_ids"] == [setup["role_vip_id"]]

    # 2. Cria canal de voz privado exclusivo para VIP
    payload_voice = {
        "name": "call-vip",
        "type": "VOICE",
        "category": "Canais de Voz",
        "is_private": True,
        "allowed_role_ids": [setup["role_vip_id"]]
    }
    res_voice = client.post(f"/api/v1/discord/servers/{setup['server_id']}/channels", json=payload_voice, headers=headers)
    assert res_voice.status_code == 201
    data_voice = res_voice.json()
    assert data_voice["name"] == "call-vip"
    assert data_voice["type"] == "VOICE"
    assert data_voice["is_private"] is True
    assert data_voice["allowed_role_ids"] == [setup["role_vip_id"]]

def test_list_channels_filters_private_by_role(private_channel_setup):
    """Valida que o membro sem cargo não enxerga o canal privado, enquanto o VIP enxerga."""
    setup = private_channel_setup
    db = TestingSessionLocal()

    # Cria canal privado para VIP
    priv_ch = Channel(
        server_id=setup["server_id"],
        name="segredo-vip",
        type="TEXT",
        category="Canais de Texto",
        is_private=True
    )
    db.add(priv_ch)
    db.commit()

    perm = ChannelRolePermission(channel_id=priv_ch.id, role_id=setup["role_vip_id"])
    db.add(perm)
    db.commit()
    db.close()

    # Membro Comum listando canais: deve ver APENAS o público
    token_reg = get_auth_token(setup["regular_email"])
    res_reg = client.get(f"/api/v1/discord/servers/{setup['server_id']}/channels", headers={"Authorization": f"Bearer {token_reg}"})
    assert res_reg.status_code == 200
    names_reg = [ch["name"] for ch in res_reg.json()]
    assert "geral" in names_reg
    assert "segredo-vip" not in names_reg

    # Membro VIP listando canais: deve ver o público E o privado
    token_vip = get_auth_token(setup["vip_email"])
    res_vip = client.get(f"/api/v1/discord/servers/{setup['server_id']}/channels", headers={"Authorization": f"Bearer {token_vip}"})
    assert res_vip.status_code == 200
    names_vip = [ch["name"] for ch in res_vip.json()]
    assert "geral" in names_vip
    assert "segredo-vip" in names_vip

    # Dono do Servidor: vê todos
    token_owner = get_auth_token(setup["owner_email"])
    res_owner = client.get(f"/api/v1/discord/servers/{setup['server_id']}/channels", headers={"Authorization": f"Bearer {token_owner}"})
    assert res_owner.status_code == 200
    names_owner = [ch["name"] for ch in res_owner.json()]
    assert "segredo-vip" in names_owner

def test_private_channel_message_and_voice_access_control(private_channel_setup):
    """Valida que acessos diretos de mensagens e token de voz são bloqueados com 403 para não autorizados."""
    setup = private_channel_setup
    db = TestingSessionLocal()

    # Canal de texto privado
    priv_text = Channel(
        server_id=setup["server_id"],
        name="sala-secreta",
        type="TEXT",
        category="Canais de Texto",
        is_private=True
    )
    # Canal de voz privado
    priv_voice = Channel(
        server_id=setup["server_id"],
        name="voz-secreta",
        type="VOICE",
        category="Canais de Voz",
        is_private=True
    )
    db.add_all([priv_text, priv_voice])
    db.commit()

    perm_text = ChannelRolePermission(channel_id=priv_text.id, role_id=setup["role_vip_id"])
    perm_voice = ChannelRolePermission(channel_id=priv_voice.id, role_id=setup["role_vip_id"])
    db.add_all([perm_text, perm_voice])
    db.commit()

    priv_text_id = priv_text.id
    priv_voice_id = priv_voice.id
    db.close()

    token_reg = get_auth_token(setup["regular_email"])
    headers_reg = {"Authorization": f"Bearer {token_reg}"}

    token_vip = get_auth_token(setup["vip_email"])
    headers_vip = {"Authorization": f"Bearer {token_vip}"}

    # 1. Membro Comum tentando ler mensagens do canal privado -> 403
    res_read = client.get(f"/api/v1/discord/channels/{priv_text_id}/messages", headers=headers_reg)
    assert res_read.status_code == 403
    assert "Você não tem permissão para acessar este canal privado" in res_read.json()["detail"]

    # 2. Membro Comum tentando enviar mensagem no canal privado -> 403
    res_send = client.post(f"/api/v1/discord/channels/{priv_text_id}/messages", json={"content": "Tentando invadir"}, headers=headers_reg)
    assert res_send.status_code == 403

    # 3. Membro Comum tentando obter voice-token no canal de voz privado -> 403
    res_voice = client.post(f"/api/v1/discord/channels/{priv_voice_id}/voice-token", headers=headers_reg)
    assert res_voice.status_code == 403

    # 4. Membro VIP enviando mensagem com sucesso -> 201
    res_vip_send = client.post(f"/api/v1/discord/channels/{priv_text_id}/messages", json={"content": "Mensagem VIP legítima"}, headers=headers_vip)
    assert res_vip_send.status_code == 201
    assert res_vip_send.json()["content"] == "Mensagem VIP legítima"

    # 5. Membro VIP lendo mensagens com sucesso -> 200
    res_vip_read = client.get(f"/api/v1/discord/channels/{priv_text_id}/messages", headers=headers_vip)
    assert res_vip_read.status_code == 200
    assert len(res_vip_read.json()) == 1

    # 6. Membro VIP obtendo token de voz com sucesso -> 200
    res_vip_voice = client.post(f"/api/v1/discord/channels/{priv_voice_id}/voice-token", headers=headers_vip)
    assert res_vip_voice.status_code == 200
    assert "token" in res_vip_voice.json()

def test_update_channel_privacy_and_roles(private_channel_setup):
    """Valida a atualização de um canal de público para privado e modificação de cargos permitidos."""
    setup = private_channel_setup
    token = get_auth_token(setup["owner_email"])
    headers = {"Authorization": f"Bearer {token}"}

    # Transforma o canal público 'geral' em privado com restrição para VIP
    payload_update = {
        "name": "geral-restrito",
        "is_private": True,
        "allowed_role_ids": [setup["role_vip_id"]]
    }
    res_patch = client.patch(
        f"/api/v1/discord/servers/{setup['server_id']}/channels/{setup['public_ch_id']}",
        json=payload_update,
        headers=headers
    )
    assert res_patch.status_code == 200
    data = res_patch.json()
    assert data["name"] == "geral-restrito"
    assert data["is_private"] is True
    assert data["allowed_role_ids"] == [setup["role_vip_id"]]

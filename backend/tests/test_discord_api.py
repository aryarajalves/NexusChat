import pytest
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from conftest import client, TestingSessionLocal

@pytest.fixture
def member_user():
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == "membro@teste.com").first()
    if not existing:
        user = User(
            email="membro@teste.com",
            name="Membro Teste",
            hashed_password=get_password_hash("Senha@Forte1234!"),
            role="user",
            is_active=True,
            max_servers=100
        )
        db.add(user)
        db.commit()
    db.close()
    return "membro@teste.com"

def get_auth_headers(email=settings.SUPERADMIN_EMAIL, password=settings.SUPERADMIN_PASSWORD):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_create_server_and_defaults():
    """Valida a criação de um servidor e os canais padrão #geral (texto) e geral (voz)."""
    headers = get_auth_headers()
    payload = {
        "name": "Comunidade Python",
        "description": "Servidor para programadores",
        "icon_url": "https://example.com/icon.png"
    }
    res = client.post("/api/v1/discord/servers", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Comunidade Python"
    assert data["members_count"] == 1
    assert len(data["channels"]) == 2
    
    # Verifica canais padrão gerados automaticamente
    channel_types = [c["type"] for c in data["channels"]]
    assert "TEXT" in channel_types
    assert "VOICE" in channel_types

def test_server_limit_enforcement():
    """Valida a regra de limite de servidores por conta."""
    headers = get_auth_headers()
    
    # Altera max_servers do superadmin para 1
    db = TestingSessionLocal()
    user = db.query(User).filter(User.email == settings.SUPERADMIN_EMAIL).first()
    user.max_servers = 1
    db.commit()
    db.close()

    # Primeiro servidor deve ser criado com sucesso
    res1 = client.post("/api/v1/discord/servers", json={"name": "Servidor 1"}, headers=headers)
    assert res1.status_code == 201

    # Segundo servidor deve falhar por teto atingido
    res2 = client.post("/api/v1/discord/servers", json={"name": "Servidor 2"}, headers=headers)
    assert res2.status_code == 400
    assert "Limite máximo" in res2.json()["detail"]

def test_create_channel_in_server():
    """Valida a criação de canais de texto e voz dentro do servidor."""
    headers = get_auth_headers()
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Teste"}, headers=headers)
    server_id = srv_res.json()["id"]

    # Cria canal de texto
    c_res = client.post(
        f"/api/v1/discord/servers/{server_id}/channels",
        json={"name": "duvidas dev", "type": "TEXT", "category": "Ajuda"},
        headers=headers
    )
    assert c_res.status_code == 201
    assert c_res.json()["name"] == "duvidas-dev"
    assert c_res.json()["category"] == "Ajuda"

    # Lista canais
    list_res = client.get(f"/api/v1/discord/servers/{server_id}/channels", headers=headers)
    assert list_res.status_code == 200
    channel_names = [c["name"] for c in list_res.json()]
    assert "duvidas-dev" in channel_names

def test_message_sending_and_limits():
    """Valida envio de mensagem e limites de caracteres (2.000 max)."""
    headers = get_auth_headers()
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Chat"}, headers=headers)
    server_id = srv_res.json()["id"]
    channels = srv_res.json()["channels"]
    text_channel = next(c for c in channels if c["type"] == "TEXT")
    channel_id = text_channel["id"]

    # Mensagem normal válida
    msg_res = client.post(
        f"/api/v1/discord/channels/{channel_id}/messages",
        json={"content": "Olá a todos do servidor!"},
        headers=headers
    )
    assert msg_res.status_code == 201
    assert msg_res.json()["content"] == "Olá a todos do servidor!"
    assert msg_res.json()["author_name"] == settings.SUPERADMIN_NAME

    # Mensagem acima de 2.000 caracteres deve ser rejeitada
    long_content = "A" * 2001
    invalid_res = client.post(
        f"/api/v1/discord/channels/{channel_id}/messages",
        json={"content": long_content},
        headers=headers
    )
    assert invalid_res.status_code in [400, 422]

def test_server_invite_and_join(member_user):
    """Valida a geração de convite e a entrada de um novo usuário no servidor."""
    owner_headers = get_auth_headers()
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Convites"}, headers=owner_headers)
    server_id = srv_res.json()["id"]

    # Cria convite
    inv_res = client.post(
        f"/api/v1/discord/servers/{server_id}/invites",
        json={"max_uses": 5, "expires_in_hours": 12},
        headers=owner_headers
    )
    assert inv_res.status_code == 201
    invite_code = inv_res.json()["code"]

    # Segundo usuário entra no servidor
    member_headers = get_auth_headers("membro@teste.com", "Senha@Forte1234!")
    join_res = client.post(f"/api/v1/discord/invites/{invite_code}/join", headers=member_headers)
    assert join_res.status_code == 200
    assert join_res.json()["name"] == "Servidor Convites"

    # Confirma que agora há 2 membros no servidor
    members_res = client.get(f"/api/v1/discord/servers/{server_id}/members", headers=owner_headers)
    assert members_res.status_code == 200
    assert len(members_res.json()) == 2

def test_non_member_forbidden(member_user):
    """Usuário que não é membro não pode ver mensagens do servidor."""
    owner_headers = get_auth_headers()
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Secreto"}, headers=owner_headers)
    text_channel = next(c for c in srv_res.json()["channels"] if c["type"] == "TEXT")
    channel_id = text_channel["id"]

    # Usuário que não entrou no servidor tenta acessar mensagens
    member_headers = get_auth_headers("membro@teste.com", "Senha@Forte1234!")
    res = client.get(f"/api/v1/discord/channels/{channel_id}/messages", headers=member_headers)
    assert res.status_code == 403

def test_message_edit_flow(member_user):
    """Valida a edição de mensagem pelo autor e bloqueio para outros usuários."""
    owner_headers = get_auth_headers()
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Edicao"}, headers=owner_headers)
    text_channel = next(c for c in srv_res.json()["channels"] if c["type"] == "TEXT")
    channel_id = text_channel["id"]

    # Cria mensagem inicial
    msg_res = client.post(
        f"/api/v1/discord/channels/{channel_id}/messages",
        json={"content": "Texto original sem edicao"},
        headers=owner_headers
    )
    assert msg_res.status_code == 201
    msg_id = msg_res.json()["id"]
    assert msg_res.json()["is_edited"] is False

    # Autor edita mensagem
    edit_res = client.patch(
        f"/api/v1/discord/channels/{channel_id}/messages/{msg_id}",
        json={"content": "Texto devidamente corrigido"},
        headers=owner_headers
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["content"] == "Texto devidamente corrigido"
    assert edit_res.json()["is_edited"] is True

    # Outro usuário entra e tenta editar a mensagem de outrem (deve dar 403)
    inv_res = client.post(f"/api/v1/discord/servers/{srv_res.json()['id']}/invites", json={}, headers=owner_headers)
    member_headers = get_auth_headers("membro@teste.com", "Senha@Forte1234!")
    client.post(f"/api/v1/discord/invites/{inv_res.json()['code']}/join", headers=member_headers)

    forbidden_res = client.patch(
        f"/api/v1/discord/channels/{channel_id}/messages/{msg_id}",
        json={"content": "Tentativa indevida de hacker"},
        headers=member_headers
    )
    assert forbidden_res.status_code == 403

def test_message_reactions_toggle():
    """Valida a adição e remoção de reações com emoji na mensagem."""
    headers = get_auth_headers()
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Reacoes"}, headers=headers)
    text_channel = next(c for c in srv_res.json()["channels"] if c["type"] == "TEXT")
    channel_id = text_channel["id"]

    msg_res = client.post(
        f"/api/v1/discord/channels/{channel_id}/messages",
        json={"content": "Notícia muito legal para reagir!"},
        headers=headers
    )
    msg_id = msg_res.json()["id"]

    # Adiciona reação com emoji
    react1 = client.post(
        f"/api/v1/discord/channels/{channel_id}/messages/{msg_id}/reactions",
        json={"emoji": "🔥"},
        headers=headers
    )
    assert react1.status_code == 200
    assert react1.json()["action"] == "added"
    assert len(react1.json()["reactions"]) == 1
    assert react1.json()["reactions"][0]["emoji"] == "🔥"
    assert react1.json()["reactions"][0]["count"] == 1
    assert react1.json()["reactions"][0]["reacted_by_me"] is True

    # Clica no mesmo emoji novamente (toggle off/remove)
    react2 = client.post(
        f"/api/v1/discord/channels/{channel_id}/messages/{msg_id}/reactions",
        json={"emoji": "🔥"},
        headers=headers
    )
    assert react2.status_code == 200
    assert react2.json()["action"] == "removed"
    assert len(react2.json()["reactions"]) == 0

def test_message_forward():
    """Valida o encaminhamento de mensagem para outro canal de texto."""
    headers = get_auth_headers()
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Encaminhar"}, headers=headers)
    server_id = srv_res.json()["id"]
    ch1_id = next(c for c in srv_res.json()["channels"] if c["type"] == "TEXT")["id"]

    # Cria segundo canal de texto
    ch2_res = client.post(
        f"/api/v1/discord/servers/{server_id}/channels",
        json={"name": "anuncios", "type": "TEXT", "category": "Canais de Texto"},
        headers=headers
    )
    ch2_id = ch2_res.json()["id"]

    # Cria mensagem no canal 1
    msg1 = client.post(
        f"/api/v1/discord/channels/{ch1_id}/messages",
        json={"content": "Mensagem muito importante de aviso"},
        headers=headers
    )
    msg1_id = msg1.json()["id"]

    # Encaminha para canal 2
    fwd_res = client.post(
        f"/api/v1/discord/channels/{ch1_id}/messages/{msg1_id}/forward",
        json={"target_channel_id": ch2_id},
        headers=headers
    )
    assert fwd_res.status_code == 201
    assert fwd_res.json()["channel_id"] == ch2_id
    assert "Encaminhado de @" in fwd_res.json()["content"]
    assert "Mensagem muito importante de aviso" in fwd_res.json()["content"]

def test_create_server_invite_without_body():
    """Valida que gerar convite sem corpo de requisição (body vazio) funciona perfeitamente com valores padrão."""
    headers = get_auth_headers()
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Convite Sem Body"}, headers=headers)
    assert srv_res.status_code == 201
    server_id = srv_res.json()["id"]

    # Chamada POST sem enviar json (body vazio)
    inv_res = client.post(f"/api/v1/discord/servers/{server_id}/invites", headers=headers)
    assert inv_res.status_code == 201
    data = inv_res.json()
    assert data["server_id"] == server_id
    assert data["code"] is not None
    assert len(data["code"]) > 0
    assert data["current_uses"] == 0

def test_delete_server_success_by_owner_or_superadmin():
    """Valida a exclusão de um servidor pelo dono ou superadmin, com cascade de canais."""
    headers = get_auth_headers()
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Para Deletar"}, headers=headers)
    assert srv_res.status_code == 201
    server_id = srv_res.json()["id"]

    # Deleta servidor
    del_res = client.delete(f"/api/v1/discord/servers/{server_id}", headers=headers)
    assert del_res.status_code == 200
    assert "excluído com sucesso" in del_res.json()["detail"]

    # Valida que o servidor não existe mais
    get_res = client.get(f"/api/v1/discord/servers/{server_id}", headers=headers)
    assert get_res.status_code == 404

def test_delete_server_forbidden_for_non_owner(member_user):
    """Valida que membros comuns não têm permissão para deletar o servidor."""
    # Superadmin cria servidor
    admin_headers = get_auth_headers()
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Protegido"}, headers=admin_headers)
    server_id = srv_res.json()["id"]

    # Membro comum tenta deletar
    member_headers = get_auth_headers(email=member_user, password="Senha@Forte1234!")
    del_res = client.delete(f"/api/v1/discord/servers/{server_id}", headers=member_headers)
    assert del_res.status_code == 403
    assert "pode excluí-lo" in del_res.json()["detail"]




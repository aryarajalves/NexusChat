import pytest
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from conftest import client, TestingSessionLocal


def create_search_user(email: str, name: str, password: str = "SenhaForte123!@"):
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


def setup_server_with_channel():
    headers = get_auth_headers()
    res = client.post("/api/v1/discord/servers", json={"name": "Servidor Busca Teste"}, headers=headers)
    assert res.status_code == 201
    server_data = res.json()
    server_id = server_data["id"]
    text_channel = [c for c in server_data["channels"] if c["type"] == "TEXT"][0]
    return server_id, text_channel["id"], headers


def test_search_channel_messages_by_keyword():
    server_id, channel_id, headers = setup_server_with_channel()

    # Envia mensagens de teste
    client.post(f"/api/v1/discord/channels/{channel_id}/messages", json={"content": "Mensagem com palavra chave Alfa"}, headers=headers)
    client.post(f"/api/v1/discord/channels/{channel_id}/messages", json={"content": "Mensagem com palavra chave Beta"}, headers=headers)
    client.post(f"/api/v1/discord/channels/{channel_id}/messages", json={"content": "Outra mensagem comum sem nada"}, headers=headers)

    # Busca por "Alfa"
    res = client.get(f"/api/v1/discord/channels/{channel_id}/search?q=Alfa", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert "Alfa" in data["messages"][0]["content"]

    # Busca case-insensitive por "alfa"
    res_lower = client.get(f"/api/v1/discord/channels/{channel_id}/search?q=alfa", headers=headers)
    assert res_lower.status_code == 200
    assert res_lower.json()["total"] == 1

    # Busca abrangente por "chave"
    res_key = client.get(f"/api/v1/discord/channels/{channel_id}/search?q=chave", headers=headers)
    assert res_key.status_code == 200
    assert res_key.json()["total"] == 2


def test_search_channel_messages_by_attachment():
    server_id, channel_id, headers = setup_server_with_channel()

    # Envia uma mensagem sem anexo e outra com anexo
    client.post(f"/api/v1/discord/channels/{channel_id}/messages", json={"content": "Apenas texto puro"}, headers=headers)
    client.post(
        f"/api/v1/discord/channels/{channel_id}/messages",
        json={
            "content": "Comprovante anexado",
            "attachment_url": "/uploads/discord/imagem_teste.png",
            "attachment_type": "image/png",
            "attachment_size": 2048
        },
        headers=headers
    )

    # Busca apenas com anexos
    res_att = client.get(f"/api/v1/discord/channels/{channel_id}/search?has_attachment=true", headers=headers)
    assert res_att.status_code == 200
    data_att = res_att.json()
    assert data_att["total"] == 1
    assert data_att["messages"][0]["attachment_url"] == "/uploads/discord/imagem_teste.png"

    # Busca apenas sem anexos
    res_no_att = client.get(f"/api/v1/discord/channels/{channel_id}/search?has_attachment=false", headers=headers)
    assert res_no_att.status_code == 200
    data_no_att = res_no_att.json()
    assert all(m["attachment_url"] is None for m in data_no_att["messages"])


def test_search_server_messages_across_channels():
    server_id, ch1_id, headers = setup_server_with_channel()

    # Cria segundo canal no servidor
    res_ch2 = client.post(
        f"/api/v1/discord/servers/{server_id}/channels",
        json={"name": "anuncios", "type": "TEXT"},
        headers=headers
    )
    assert res_ch2.status_code == 201
    ch2_id = res_ch2.json()["id"]

    # Mensagens em canais diferentes
    client.post(f"/api/v1/discord/channels/{ch1_id}/messages", json={"content": "Projeto Gamma no canal 1"}, headers=headers)
    client.post(f"/api/v1/discord/channels/{ch2_id}/messages", json={"content": "Aviso sobre Projeto Gamma no canal 2"}, headers=headers)

    # Busca em todo o servidor
    res_srv = client.get(f"/api/v1/discord/servers/{server_id}/search?q=Gamma", headers=headers)
    assert res_srv.status_code == 200
    data = res_srv.json()
    assert data["total"] == 2
    found_channels = {m["channel_id"] for m in data["messages"]}
    assert ch1_id in found_channels
    assert ch2_id in found_channels


def test_search_dm_messages():
    headers1 = get_auth_headers()
    u2_id = create_search_user("buscadm@teste.com", "Colega Busca", "SenhaForte123!@")
    headers2 = get_auth_headers("buscadm@teste.com", "SenhaForte123!@")

    # Inicia DM
    res_conv = client.post("/api/v1/discord/dms/conversations", json={"target_user_id": u2_id}, headers=headers1)
    assert res_conv.status_code == 201
    conv_id = res_conv.json()["id"]

    # Envia mensagens na DM
    client.post(f"/api/v1/discord/dms/conversations/{conv_id}/messages", json={"content": "Senha secreta do cofre 9988"}, headers=headers1)
    client.post(f"/api/v1/discord/dms/conversations/{conv_id}/messages", json={"content": "Tudo certo para a reunião amanhã"}, headers=headers2)

    # Busca na DM
    res_search = client.get(f"/api/v1/discord/dms/{conv_id}/search?q=cofre", headers=headers1)
    assert res_search.status_code == 200
    data = res_search.json()
    assert data["total"] == 1
    assert "9988" in data["messages"][0]["content"]

    # Usuário terceiro não participante recebe 403
    u3_id = create_search_user("intruso@teste.com", "Intruso", "SenhaForte123!@")
    headers3 = get_auth_headers("intruso@teste.com", "SenhaForte123!@")
    res_denied = client.get(f"/api/v1/discord/dms/{conv_id}/search?q=cofre", headers=headers3)
    assert res_denied.status_code == 403

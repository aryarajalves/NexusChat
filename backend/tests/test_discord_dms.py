import pytest
from conftest import client
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from conftest import TestingSessionLocal

def create_user(email: str, name: str, password: str = "SenhaForte123!@"):
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        u = User(
            email=email,
            name=name,
            hashed_password=get_password_hash(password),
            role="user",
            is_active=True
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        uid = u.id
    else:
        uid = existing.id
    db.close()
    return uid

def get_auth_headers(email: str = settings.SUPERADMIN_EMAIL, password: str = settings.SUPERADMIN_PASSWORD):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_dm_users_list():
    """Valida a listagem de usuários elegíveis para iniciar conversa privada e campo avatar_url."""
    u2_id = create_user("amigo1@teste.com", "Amigo Um")
    headers = get_auth_headers()

    res = client.get("/api/v1/discord/dms/users", headers=headers)
    assert res.status_code == 200
    users = res.json()
    assert isinstance(users, list)
    assert any(u["id"] == u2_id for u in users)
    # Verifica presença do campo avatar_url no schema
    assert "avatar_url" in users[0]


def test_dm_conversation_creation_and_deduplication():
    """Valida a criação e recuperação idempotente de conversas de DM."""
    headers1 = get_auth_headers()
    u2_id = create_user("amigo2@teste.com", "Amigo Dois")

    # 1. Tentar criar conversa consigo mesmo (deve falhar com 400)
    me_res = client.post("/api/v1/discord/dms/conversations", json={"target_user_id": 1}, headers=headers1)
    assert me_res.status_code == 400

    # 2. Criar conversa válida com o Amigo Dois
    conv_res = client.post("/api/v1/discord/dms/conversations", json={"target_user_id": u2_id}, headers=headers1)
    assert conv_res.status_code == 201
    conv_data = conv_res.json()
    conv_id = conv_data["id"]
    assert conv_data["other_user"]["id"] == u2_id
    assert conv_data["other_user"]["name"] == "Amigo Dois"

    # 3. Chamar novamente deve retornar a mesma conversa (idempotente)
    conv_res2 = client.post("/api/v1/discord/dms/conversations", json={"target_user_id": u2_id}, headers=headers1)
    assert conv_res2.status_code == 201
    assert conv_res2.json()["id"] == conv_id

    # 4. Listar conversas do usuário deve incluir a conversa criada
    list_res = client.get("/api/v1/discord/dms/conversations", headers=headers1)
    assert list_res.status_code == 200
    assert any(c["id"] == conv_id for c in list_res.json())


def test_dm_send_receive_edit_delete():
    """Valida o ciclo completo de envio, listagem, edição e exclusão de mensagens privadas."""
    headers1 = get_auth_headers()
    u2_id = create_user("amigo3@teste.com", "Amigo Tres")
    headers2 = get_auth_headers("amigo3@teste.com", "SenhaForte123!@")

    # Cria conversa
    conv_res = client.post("/api/v1/discord/dms/conversations", json={"target_user_id": u2_id}, headers=headers1)
    conv_id = conv_res.json()["id"]

    # Usuário 1 envia mensagem
    msg1_res = client.post(
        f"/api/v1/discord/dms/conversations/{conv_id}/messages",
        json={"content": "Oi Amigo 3, tudo bem no privado?"},
        headers=headers1
    )
    assert msg1_res.status_code == 201
    msg1 = msg1_res.json()
    assert msg1["content"] == "Oi Amigo 3, tudo bem no privado?"
    assert msg1["author_name"] == settings.SUPERADMIN_NAME
    msg1_id = msg1["id"]

    # Usuário 2 visualiza o histórico da conversa
    history_res = client.get(f"/api/v1/discord/dms/conversations/{conv_id}/messages", headers=headers2)
    assert history_res.status_code == 200
    assert len(history_res.json()) == 1
    assert history_res.json()[0]["id"] == msg1_id

    # Usuário 2 responde a mensagem
    msg2_res = client.post(
        f"/api/v1/discord/dms/conversations/{conv_id}/messages",
        json={"content": "Tudo ótimo por aqui!", "reply_to_id": msg1_id},
        headers=headers2
    )
    assert msg2_res.status_code == 201
    assert msg2_res.json()["reply_to_id"] == msg1_id

    # Usuário 1 edita sua mensagem
    edit_res = client.patch(
        f"/api/v1/discord/dms/messages/{msg1_id}",
        json={"content": "Oi Amigo 3, tudo bem no privado? (Atualizado)"},
        headers=headers1
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["is_edited"] is True
    assert "Atualizado" in edit_res.json()["content"]

    # Usuário 2 tenta editar a mensagem do Usuário 1 (deve dar 403)
    forbid_edit = client.patch(
        f"/api/v1/discord/dms/messages/{msg1_id}",
        json={"content": "Tentativa indevida"},
        headers=headers2
    )
    assert forbid_edit.status_code == 403

    # Usuário 1 exclui a mensagem
    del_res = client.delete(f"/api/v1/discord/dms/messages/{msg1_id}", headers=headers1)
    assert del_res.status_code == 200

    # Mensagem não deve mais constar no histórico
    history2 = client.get(f"/api/v1/discord/dms/conversations/{conv_id}/messages", headers=headers1)
    assert len(history2.json()) == 1
    assert history2.json()[0]["id"] != msg1_id


def test_dm_message_reactions():
    """Valida adição e remoção de reações com emojis em mensagens de DM."""
    headers1 = get_auth_headers()
    u2_id = create_user("amigo4@teste.com", "Amigo Quatro")

    conv_res = client.post("/api/v1/discord/dms/conversations", json={"target_user_id": u2_id}, headers=headers1)
    conv_id = conv_res.json()["id"]

    msg_res = client.post(
        f"/api/v1/discord/dms/conversations/{conv_id}/messages",
        json={"content": "Mensagem para reagir"},
        headers=headers1
    )
    msg_id = msg_res.json()["id"]

    # Adiciona reação
    r1 = client.post(f"/api/v1/discord/dms/messages/{msg_id}/reactions", json={"emoji": "👏"}, headers=headers1)
    assert r1.status_code == 200
    assert r1.json()["action"] == "added"
    assert len(r1.json()["reactions"]) == 1

    # Remove reação
    r2 = client.post(f"/api/v1/discord/dms/messages/{msg_id}/reactions", json={"emoji": "👏"}, headers=headers1)
    assert r2.status_code == 200
    assert r2.json()["action"] == "removed"
    assert len(r2.json()["reactions"]) == 0


def test_dm_forbidden_access_to_unrelated_user():
    """Garante que um terceiro usuário não consegue ler nem enviar mensagens em conversas alheias."""
    headers1 = get_auth_headers()
    u2_id = create_user("amigo5@teste.com", "Amigo Cinco")
    u3_id = create_user("estranho@teste.com", "Estranho")
    headers3 = get_auth_headers("estranho@teste.com", "SenhaForte123!@")

    conv_res = client.post("/api/v1/discord/dms/conversations", json={"target_user_id": u2_id}, headers=headers1)
    conv_id = conv_res.json()["id"]

    # Estranho tenta ler histórico
    spy_res = client.get(f"/api/v1/discord/dms/conversations/{conv_id}/messages", headers=headers3)
    assert spy_res.status_code == 403

    # Estranho tenta enviar mensagem
    spy_send = client.post(
        f"/api/v1/discord/dms/conversations/{conv_id}/messages",
        json={"content": "Invasão"},
        headers=headers3
    )
    assert spy_send.status_code == 403


def test_dm_websocket_heartbeat_ping():
    """Valida que o WebSocket de DMs responde a requisições de heartbeat ping com pong."""
    headers1 = get_auth_headers()
    u2_id = create_user("amigo_hb@teste.com", "Amigo Heartbeat")
    conv_res = client.post("/api/v1/discord/dms/conversations", json={"target_user_id": u2_id}, headers=headers1)
    conv_id = conv_res.json()["id"]

    token = headers1["Authorization"].split(" ")[1]
    with client.websocket_connect(f"/api/v1/discord/dms/ws/{conv_id}?token={token}") as ws:
        ws.send_json({"type": "ping"})
        response = ws.receive_json()
        assert response.get("type") == "pong" or response.get("event") == "pong"


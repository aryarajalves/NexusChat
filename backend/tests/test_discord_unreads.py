import pytest
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from conftest import client, TestingSessionLocal


def create_unreads_user(email: str, name: str, password: str = "SenhaForte123!@"):
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        u = User(
            email=email,
            name=name,
            hashed_password=get_password_hash(password),
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


def get_token(email: str, password: str = "SenhaForte123!@"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_channel_unreads_and_ack():
    user1_email = "unread_user1@teste.com"
    user2_email = "unread_user2@teste.com"
    create_unreads_user(user1_email, "User Um")
    u2_id = create_unreads_user(user2_email, "User Dois")

    h1 = get_token(user1_email)
    h2 = get_token(user2_email)

    # User 1 cria servidor
    res_srv = client.post("/api/v1/discord/servers", json={"name": "Servidor Unreads"}, headers=h1)
    assert res_srv.status_code == 201
    srv_data = res_srv.json()
    srv_id = srv_data["id"]
    text_ch = [c for c in srv_data["channels"] if c["type"] == "TEXT"][0]
    ch_id = text_ch["id"]

    # Gera convite e User 2 entra
    res_inv = client.post(f"/api/v1/discord/servers/{srv_id}/invites", json={}, headers=h1)
    assert res_inv.status_code == 201
    code = res_inv.json()["code"]
    res_join = client.post(f"/api/v1/discord/invites/{code}/join", headers=h2)
    assert res_join.status_code == 200

    # User 2 marca como lido inicialmente
    client.post(f"/api/v1/discord/channels/{ch_id}/ack", headers=h2)

    # User 1 envia mensagem
    res_msg = client.post(
        f"/api/v1/discord/channels/{ch_id}/messages",
        json={"content": "Mensagem para testar não lidas"},
        headers=h1,
    )
    assert res_msg.status_code == 201

    # User 2 consulta unreads -> deve ter 1 no canal e 1 no servidor
    res_unreads = client.get("/api/v1/discord/unreads", headers=h2)
    assert res_unreads.status_code == 200
    data = res_unreads.json()
    assert data["channels"].get(str(ch_id)) == 1
    assert data["servers"].get(str(srv_id)) >= 1

    # User 2 dá ack no canal -> deve zerar
    res_ack = client.post(f"/api/v1/discord/channels/{ch_id}/ack", headers=h2)
    assert res_ack.status_code == 200
    assert res_ack.json()["unread"] == 0

    # Consulta novamente -> deve ser 0
    res_unreads_after = client.get("/api/v1/discord/unreads", headers=h2)
    assert res_unreads_after.json()["channels"].get(str(ch_id)) == 0


def test_dm_unreads_and_ack():
    user_a_email = "dm_unread_a@teste.com"
    user_b_email = "dm_unread_b@teste.com"
    u_a_id = create_unreads_user(user_a_email, "User A")
    u_b_id = create_unreads_user(user_b_email, "User B")

    h_a = get_token(user_a_email)
    h_b = get_token(user_b_email)

    # Cria conversa entre A e B
    res_conv = client.post(
        "/api/v1/discord/dms/conversations",
        json={"target_user_id": u_b_id},
        headers=h_a,
    )
    assert res_conv.status_code == 201
    conv_id = res_conv.json()["id"]

    # User B dá ack inicial
    client.post(f"/api/v1/discord/dms/conversations/{conv_id}/ack", headers=h_b)

    # User A envia mensagem direta
    res_msg = client.post(
        f"/api/v1/discord/dms/conversations/{conv_id}/messages",
        json={"content": "Oi User B, DM não lida!"},
        headers=h_a,
    )
    assert res_msg.status_code == 201

    # User B consulta unreads
    res_unreads = client.get("/api/v1/discord/unreads", headers=h_b)
    assert res_unreads.status_code == 200
    data = res_unreads.json()
    assert data["dms"].get(str(conv_id)) == 1
    assert data["total_dms"] >= 1

    # User B dá ack na conversa
    res_ack = client.post(f"/api/v1/discord/dms/conversations/{conv_id}/ack", headers=h_b)
    assert res_ack.status_code == 200
    assert res_ack.json()["unread"] == 0

    # Consulta novamente
    res_unreads_after = client.get("/api/v1/discord/unreads", headers=h_b)
    assert res_unreads_after.json()["dms"].get(str(conv_id)) == 0

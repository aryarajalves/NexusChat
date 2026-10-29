import pytest
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User
from conftest import client, TestingSessionLocal

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

def test_optimized_channel_and_dm_unreads():
    """Valida a query agregada em lote para canais e DMs sem problema N+1."""
    u1_email = "opt_user1@teste.com"
    u2_email = "opt_user2@teste.com"
    create_user_helper(u1_email, "User Opt 1")
    u2_id = create_user_helper(u2_email, "User Opt 2")

    h1 = get_auth_token(u1_email)
    h2 = get_auth_token(u2_email)

    # User 1 cria servidor com canal de texto
    res_srv = client.post("/api/v1/discord/servers", json={"name": "Servidor Opt Unreads"}, headers=h1)
    assert res_srv.status_code == 201
    srv_data = res_srv.json()
    srv_id = srv_data["id"]
    text_channel = [c for c in srv_data["channels"] if c["type"] == "TEXT"][0]
    ch_id = text_channel["id"]

    # User 2 entra no servidor
    res_inv = client.post(f"/api/v1/discord/servers/{srv_id}/invites", json={}, headers=h1)
    code = res_inv.json()["code"]
    client.post(f"/api/v1/discord/invites/{code}/join", headers=h2)

    # User 1 envia 3 mensagens no canal
    for i in range(3):
        res_msg = client.post(
            f"/api/v1/discord/channels/{ch_id}/messages",
            json={"content": f"Mensagem não lida #{i+1}"},
            headers=h1
        )
        assert res_msg.status_code == 201

    # User 2 verifica contagem não lida (deve ser 3)
    res_unreads = client.get("/api/v1/discord/unreads", headers=h2)
    assert res_unreads.status_code == 200
    data = res_unreads.json()
    assert data["channels"][str(ch_id)] == 3
    assert data["servers"][str(srv_id)] == 3

    # User 1 (autor) não deve ter mensagens não lidas geradas por si mesmo
    res_u1_unreads = client.get("/api/v1/discord/unreads", headers=h1)
    assert res_u1_unreads.status_code == 200
    assert res_u1_unreads.json()["channels"][str(ch_id)] == 0

    # User 2 dá ack no canal -> contador zera
    res_ack = client.post(f"/api/v1/discord/channels/{ch_id}/ack", headers=h2)
    assert res_ack.status_code == 200
    assert res_ack.json()["unread"] == 0

    res_unreads_after = client.get("/api/v1/discord/unreads", headers=h2)
    assert res_unreads_after.json()["channels"][str(ch_id)] == 0
    assert res_unreads_after.json()["servers"][str(srv_id)] == 0

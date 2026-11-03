import io
import pytest
from conftest import client, TestingSessionLocal
from app.models.user import User
from app.models.discord import Server, Channel, ServerMember, Message, MessageThread, ThreadMessage
from app.core.security import get_password_hash, create_access_token


@pytest.fixture
def thread_setup():
    db = TestingSessionLocal()
    try:
        user = db.query(User).filter(User.email == "thread_user@teste.com").first()
        if not user:
            user = User(
                email="thread_user@teste.com",
                name="Thread Master",
                hashed_password=get_password_hash("SenhaForte123!@"),
                role="user",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        user2 = db.query(User).filter(User.email == "thread_user2@teste.com").first()
        if not user2:
            user2 = User(
                email="thread_user2@teste.com",
                name="Thread Participant",
                hashed_password=get_password_hash("SenhaForte123!@"),
                role="user",
                is_active=True,
            )
            db.add(user2)
            db.commit()
            db.refresh(user2)

        server = Server(name="Thread Server", owner_id=user.id)
        db.add(server)
        db.commit()
        db.refresh(server)

        db.add(ServerMember(server_id=server.id, user_id=user.id, role="OWNER"))
        db.add(ServerMember(server_id=server.id, user_id=user2.id, role="MEMBER"))

        channel = Channel(server_id=server.id, name="geral", type="TEXT")
        db.add(channel)
        db.commit()
        db.refresh(channel)

        msg = Message(channel_id=channel.id, author_id=user.id, content="Mensagem Raiz com Tópico")
        db.add(msg)
        db.commit()
        db.refresh(msg)

        token1 = create_access_token({"sub": str(user.id)})
        token2 = create_access_token({"sub": str(user2.id)})

        return {
            "server_id": server.id,
            "channel_id": channel.id,
            "message_id": msg.id,
            "user1_id": user.id,
            "user2_id": user2.id,
            "token1": token1,
            "token2": token2,
        }
    finally:
        db.close()


def test_create_thread_on_message(thread_setup):
    """Criação de tópico a partir de uma mensagem de texto existente no canal."""
    token = thread_setup["token1"]
    ch_id = thread_setup["channel_id"]
    msg_id = thread_setup["message_id"]

    res = client.post(
        f"/api/v1/discord/channels/{ch_id}/messages/{msg_id}/threads",
        json={"name": "Discussão Especial"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Discussão Especial"
    assert data["channel_id"] == ch_id
    assert data["root_message_id"] == msg_id
    assert data["creator_name"] == "Thread Master"
    assert data["root_message"]["id"] == msg_id
    assert len(data["messages"]) == 0


def test_create_thread_idempotent_returns_existing(thread_setup):
    """Garante que tentar criar outro tópico na mesma mensagem retorna o tópico já existente."""
    token = thread_setup["token1"]
    ch_id = thread_setup["channel_id"]
    msg_id = thread_setup["message_id"]

    res1 = client.post(
        f"/api/v1/discord/channels/{ch_id}/messages/{msg_id}/threads",
        json={"name": "Tópico Inicial"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res1.status_code == 201
    thread_id = res1.json()["id"]

    res2 = client.post(
        f"/api/v1/discord/channels/{ch_id}/messages/{msg_id}/threads",
        json={"name": "Outro Nome"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res2.status_code == 201
    assert res2.json()["id"] == thread_id
    assert res2.json()["name"] == "Tópico Inicial"


def test_send_message_in_thread_and_verify_feed_summary(thread_setup):
    """Envia mensagem dentro do tópico e valida o resumo/badge refletido na mensagem raiz."""
    token1 = thread_setup["token1"]
    token2 = thread_setup["token2"]
    ch_id = thread_setup["channel_id"]
    msg_id = thread_setup["message_id"]

    # Cria tópico
    t_res = client.post(
        f"/api/v1/discord/channels/{ch_id}/messages/{msg_id}/threads",
        json={"name": "oieee"},
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert t_res.status_code == 201
    t_id = t_res.json()["id"]

    # Usuário 2 envia mensagem dentro do tópico
    msg_res = client.post(
        f"/api/v1/discord/threads/{t_id}/messages",
        json={"content": "teste"},
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert msg_res.status_code == 201
    tm_data = msg_res.json()
    assert tm_data["content"] == "teste"
    assert tm_data["author_name"] == "Thread Participant"

    # Detalhes do tópico
    detail_res = client.get(
        f"/api/v1/discord/threads/{t_id}",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert len(detail_data["messages"]) == 1
    assert detail_data["messages"][0]["content"] == "teste"

    # Feed principal do canal lista a mensagem raiz acompanhada do ThreadSummary
    feed_res = client.get(
        f"/api/v1/discord/channels/{ch_id}/messages",
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert feed_res.status_code == 200
    feed_msgs = feed_res.json()
    root_in_feed = [m for m in feed_msgs if m["id"] == msg_id][0]
    assert root_in_feed["thread"] is not None
    assert root_in_feed["thread"]["name"] == "oieee"
    assert root_in_feed["thread"]["message_count"] == 1
    assert root_in_feed["thread"]["last_message_content"] == "teste"
    assert root_in_feed["thread"]["last_message_author"] == "Thread Participant"

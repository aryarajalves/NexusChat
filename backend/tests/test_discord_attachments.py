import io
import pytest
from conftest import client, TestingSessionLocal
from app.models.user import User
from app.models.discord import Server, Channel, ServerMember
from app.core.security import get_password_hash, create_access_token

@pytest.fixture
def attachment_setup():
    db = TestingSessionLocal()
    try:
        # Create user
        user = db.query(User).filter(User.email == "attach_user@test.com").first()
        if not user:
            user = User(
                email="attach_user@test.com",
                name="Attach User",
                hashed_password=get_password_hash("password123"),
                role="user",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        # Create non-member
        non_member = db.query(User).filter(User.email == "stranger@test.com").first()
        if not non_member:
            non_member = User(
                email="stranger@test.com",
                name="Stranger",
                hashed_password=get_password_hash("password123"),
                role="user",
                is_active=True
            )
            db.add(non_member)
            db.commit()
            db.refresh(non_member)

        # Create server & channel
        server = Server(name="Attach Server", owner_id=user.id)
        db.add(server)
        db.commit()
        db.refresh(server)

        member = ServerMember(server_id=server.id, user_id=user.id, role="OWNER")
        db.add(member)

        channel = Channel(server_id=server.id, name="geral", type="TEXT")
        db.add(channel)
        db.commit()
        db.refresh(channel)

        user_token = create_access_token({"sub": str(user.id)})
        stranger_token = create_access_token({"sub": str(non_member.id)})

        return {
            "user_id": user.id,
            "stranger_id": non_member.id,
            "user_token": user_token,
            "stranger_token": stranger_token,
            "channel_id": channel.id,
            "server_id": server.id
        }
    finally:
        db.close()

def test_upload_attachment_success(attachment_setup):
    token = attachment_setup["user_token"]
    ch_id = attachment_setup["channel_id"]

    file_content = b"fake-image-bytes-antigravity"
    file_obj = io.BytesIO(file_content)

    response = client.post(
        f"/api/v1/discord/channels/{ch_id}/attachments",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("screenshot.png", file_obj, "image/png")}
    )

    assert response.status_code == 200
    data = response.json()
    assert "attachment_url" in data
    assert data["attachment_type"] == "image/png"
    assert data["attachment_size"] == len(file_content)
    assert data["filename"] == "screenshot.png"

    # Fetch file using the URL
    get_res = client.get(data["attachment_url"])
    assert get_res.status_code == 200
    assert get_res.content == file_content

def test_upload_attachment_non_member(attachment_setup):
    token = attachment_setup["stranger_token"]
    ch_id = attachment_setup["channel_id"]

    file_obj = io.BytesIO(b"data")
    response = client.post(
        f"/api/v1/discord/channels/{ch_id}/attachments",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("test.png", file_obj, "image/png")}
    )
    assert response.status_code == 403

def test_upload_attachment_exceeds_50mb(attachment_setup, monkeypatch):
    token = attachment_setup["user_token"]
    ch_id = attachment_setup["channel_id"]

    from app.api.v1.endpoints import discord as discord_module
    monkeypatch.setattr(discord_module, "MAX_FILE_SIZE_BYTES", 100)  # Lower temporarily for test

    file_obj = io.BytesIO(b"A" * 150)
    response = client.post(
        f"/api/v1/discord/channels/{ch_id}/attachments",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("large.png", file_obj, "image/png")}
    )
    assert response.status_code == 400
    assert "excede o limite" in response.json()["detail"]

def test_send_message_with_attachment_only(attachment_setup):
    token = attachment_setup["user_token"]
    ch_id = attachment_setup["channel_id"]

    response = client.post(
        f"/api/v1/discord/channels/{ch_id}/messages",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "content": "",
            "attachment_url": "/api/v1/discord/attachments/sample.png",
            "attachment_type": "image/png",
            "attachment_size": 1024
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["attachment_url"] == "/api/v1/discord/attachments/sample.png"

def test_send_message_empty_text_and_no_attachment_fails(attachment_setup):
    token = attachment_setup["user_token"]
    ch_id = attachment_setup["channel_id"]

    response = client.post(
        f"/api/v1/discord/channels/{ch_id}/messages",
        headers={"Authorization": f"Bearer {token}"},
        json={"content": "   "}
    )
    assert response.status_code == 400
    assert "precisa conter texto ou anexo" in response.json()["detail"]


def test_upload_audio_voice_note(attachment_setup):
    token = attachment_setup["user_token"]
    ch_id = attachment_setup["channel_id"]

    audio_bytes = b"OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00fake_audio_stream"
    audio_file = ("audio_note.ogg", io.BytesIO(audio_bytes), "audio/ogg")

    response = client.post(
        f"/api/v1/discord/channels/{ch_id}/attachments",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": audio_file}
    )
    assert response.status_code == 200
    data = response.json()
    assert "audio" in data["attachment_type"]
    assert data["attachment_url"].startswith("/api/v1/discord/attachments/")


def test_upload_dm_attachment(attachment_setup):
    token = attachment_setup["user_token"]
    user_id = attachment_setup["user_id"]
    non_member_id = attachment_setup["stranger_id"]

    from app.models.discord import DMConversation
    db = TestingSessionLocal()
    conv = DMConversation(user1_id=user_id, user2_id=non_member_id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    conv_id = conv.id
    db.close()

    audio_bytes = b"fake-dm-voice-note"
    audio_file = ("voice_dm.webm", io.BytesIO(audio_bytes), "audio/webm")

    response = client.post(
        f"/api/v1/discord/dms/conversations/{conv_id}/attachments",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": audio_file}
    )
    assert response.status_code == 200
    assert response.json()["attachment_type"] == "audio/webm"


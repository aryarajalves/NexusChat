import os
import io
import pytest
from unittest.mock import MagicMock, patch
from app.core.config import settings
from app.services.storage import (
    upload_discord_media_file,
    get_discord_media_file_path,
    get_discord_media_presigned_url,
    DISCORD_UPLOAD_DIR
)
from conftest import client, TestingSessionLocal
from app.models.user import User
from app.core.security import get_password_hash

def get_or_create_user(email="b2_test_user@teste.com"):
    db = TestingSessionLocal()
    u = db.query(User).filter(User.email == email).first()
    if not u:
        u = User(
            email=email,
            name="B2 Tester",
            hashed_password=get_password_hash("SenhaForte123!@"),
            role="user",
            is_active=True
        )
        db.add(u)
        db.commit()
        db.refresh(u)
    db.close()
    return email

def get_auth_header(email="b2_test_user@teste.com"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "SenhaForte123!@"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_upload_discord_media_file_local_cache():
    """Valida salvamento local e retorno de metadados quando B2 não está conectado."""
    content = b"fake-media-content-test-bytes"
    filename = "test_local_media_file.txt"

    res = upload_discord_media_file(content, filename, "text/plain")
    assert res["filename"] == filename
    assert res["size"] == len(content)
    assert res["attachment_url"] == f"/api/v1/discord/attachments/{filename}"

    # Confirma que está no disco local
    saved_path = os.path.join(DISCORD_UPLOAD_DIR, filename)
    assert os.path.exists(saved_path)
    with open(saved_path, "rb") as f:
        assert f.read() == content

    # Limpeza
    os.remove(saved_path)

def test_upload_discord_media_file_with_b2_mock():
    """Valida envio para o Backblaze B2 (put_object) e marcação de storage='b2'."""
    content = b"image-png-sample-bytes"
    filename = "avatar_b2_test.png"

    mock_s3 = MagicMock()
    with patch("app.services.storage.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "my-test-b2-bucket"):
            res = upload_discord_media_file(content, filename, "image/png")

            assert res["storage"] == "b2"
            mock_s3.put_object.assert_called_once()
            call_kwargs = mock_s3.put_object.call_args[1]
            assert call_kwargs["Bucket"] == "my-test-b2-bucket"
            assert filename in call_kwargs["Key"]
            assert call_kwargs["ContentType"] == "image/png"

    # Limpeza
    saved_path = os.path.join(DISCORD_UPLOAD_DIR, filename)
    if os.path.exists(saved_path):
        os.remove(saved_path)

def test_get_discord_media_file_path_download_from_b2_if_missing():
    """Valida recuperação sob demanda a partir do Backblaze B2 se o arquivo não estiver em cache local."""
    filename = "remote_only_b2_file.dat"
    local_path = os.path.join(DISCORD_UPLOAD_DIR, filename)
    if os.path.exists(local_path):
        os.remove(local_path)

    remote_bytes = b"recovered-from-b2-cloud-storage"
    mock_s3 = MagicMock()
    mock_s3.get_object.return_value = {"Body": io.BytesIO(remote_bytes)}

    with patch("app.services.storage.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "my-test-b2-bucket"):
            retrieved_path = get_discord_media_file_path(filename)
            assert retrieved_path == local_path
            assert os.path.exists(local_path)
            with open(local_path, "rb") as f:
                assert f.read() == remote_bytes

    # Limpeza
    if os.path.exists(local_path):
        os.remove(local_path)

def test_get_discord_media_presigned_url():
    """Valida geração de URL pré-assinada do Backblaze B2."""
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://s3.us-west-004.backblazeb2.com/test?token=signed123"

    with patch("app.services.storage.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "my-test-b2-bucket"):
            url = get_discord_media_presigned_url("video_stream.webm")
            assert url is not None
            assert "backblazeb2.com" in url

def test_api_channel_attachment_upload_and_retrieve():
    """Valida upload de anexo e download via API GET /attachments/{filename}."""
    email = get_or_create_user()
    headers = get_auth_header(email)

    # Cria servidor e canal
    res_srv = client.post("/api/v1/discord/servers", json={"name": "Servidor B2 Media"}, headers=headers)
    assert res_srv.status_code == 201
    srv_data = res_srv.json()
    channel = [c for c in srv_data["channels"] if c["type"] == "TEXT"][0]

    # Envia arquivo anexo
    file_content = b"Hello Backblaze B2 Storage Integration!"
    files = {"file": ("nota.txt", io.BytesIO(file_content), "text/plain")}

    res_upload = client.post(f"/api/v1/discord/channels/{channel['id']}/attachments", files=files, headers=headers)
    assert res_upload.status_code == 200
    upload_data = res_upload.json()
    assert "attachment_url" in upload_data

    # Busca o arquivo de volta via GET
    att_url = upload_data["attachment_url"]
    res_get = client.get(att_url)
    assert res_get.status_code == 200
    assert res_get.content == file_content

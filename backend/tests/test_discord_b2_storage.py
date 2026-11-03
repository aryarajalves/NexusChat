import io
import os
from unittest.mock import MagicMock, patch
from botocore.exceptions import ClientError

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.discord import DMConversation
from app.models.user import User
from app.services.storage import (
    DISCORD_UPLOAD_DIR,
    delete_discord_media_file,
    extract_managed_media_filename,
    get_discord_media_file_path,
    get_discord_media_presigned_url,
    resolve_discord_media_delivery,
    upload_discord_media_file,
)
from conftest import TestingSessionLocal, client


def get_or_create_user(email="b2_test_user@teste.com", name="B2 Tester"):
    db = TestingSessionLocal()
    try:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            u = User(
                email=email,
                name=name,
                hashed_password=get_password_hash("SenhaForte123!@"),
                role="user",
                is_active=True,
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        return u.id, email
    finally:
        db.close()


def get_auth_header(email="b2_test_user@teste.com"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "SenhaForte123!@"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_upload_discord_media_file_local_fallback():
    """Valida fallback no disco local apenas quando o Backblaze B2 não está configurado."""
    content = b"fake-media-content-test-bytes"
    filename = "test_local_media_file.txt"

    with patch("app.services.storage.get_s3_client", return_value=None):
        res = upload_discord_media_file(content, filename, "text/plain")

    assert res["filename"] == filename
    assert res["storage"] == "local"
    assert res["size"] == len(content)
    assert res["attachment_url"] == f"/api/v1/discord/attachments/{filename}"

    saved_path = os.path.join(DISCORD_UPLOAD_DIR, filename)
    assert os.path.exists(saved_path)
    with open(saved_path, "rb") as f:
        assert f.read() == content

    os.remove(saved_path)


def test_upload_discord_media_file_b2_cloud_only_zero_local_disk():
    """
    Valida que, quando o Backblaze B2 está ativo, o arquivo vai 100% para a nuvem
    (put_object) e NENHUMA cópia fica ocupando o HD local do servidor.
    """
    content = b"video-mp4-heavy-sample-bytes"
    filename = "cloud_only_video_test.mp4"
    saved_path = os.path.join(DISCORD_UPLOAD_DIR, filename)
    if os.path.exists(saved_path):
        os.remove(saved_path)

    mock_s3 = MagicMock()
    with patch("app.services.storage.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "my-test-b2-bucket"):
            res = upload_discord_media_file(content, filename, "video/mp4")

            assert res["storage"] == "b2"
            assert res["local_path"] is None
            mock_s3.put_object.assert_called_once()
            call_kwargs = mock_s3.put_object.call_args[1]
            assert call_kwargs["Bucket"] == "my-test-b2-bucket"
            assert filename in call_kwargs["Key"]
            assert call_kwargs["ContentType"] == "video/mp4"

    # Confirma que 0 bytes foram gravados no HD local
    assert not os.path.exists(saved_path)


def test_get_discord_media_file_path_does_not_download_b2_to_disk():
    """Garante que consultar mídia remota não baixa cópia permanente para o HD local."""
    filename = "remote_only_b2_video.mp4"
    local_path = os.path.join(DISCORD_UPLOAD_DIR, filename)
    if os.path.exists(local_path):
        os.remove(local_path)

    mock_s3 = MagicMock()
    with patch("app.services.storage.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "my-test-b2-bucket"):
            retrieved_path = get_discord_media_file_path(filename)
            assert retrieved_path is None
            mock_s3.get_object.assert_not_called()
            assert not os.path.exists(local_path)


def test_get_attachment_redirects_directly_to_b2_presigned_url():
    """
    Valida que GET /api/v1/discord/attachments/{filename} redireciona (307) direto para
    a URL assinada do Backblaze B2 com Content-Disposition seguro, sem salvar no HD.
    """
    filename = "clip_b2_stream.mp4"
    local_path = os.path.join(DISCORD_UPLOAD_DIR, filename)
    if os.path.exists(local_path):
        os.remove(local_path)

    mock_s3 = MagicMock()
    mock_s3.head_object.return_value = {"ContentLength": 1048576}
    mock_s3.generate_presigned_url.return_value = (
        "https://my-test-b2-bucket.s3.us-west-004.backblazeb2.com/discord_media/clip_b2_stream.mp4?X-Amz-Signature=abc"
    )

    with patch("app.services.storage.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "my-test-b2-bucket"):
            with patch.object(settings, "BACKBLAZE_CDN_URL", ""):
                res = client.get(f"/api/v1/discord/attachments/{filename}", follow_redirects=False)
                assert res.status_code == 307
                assert "backblazeb2.com" in res.headers["location"]
                params_used = mock_s3.generate_presigned_url.call_args[1]["Params"]
                assert params_used["ResponseContentDisposition"] == "inline"
                assert not os.path.exists(local_path)

    # Testa 404 real quando objeto também não existe no Backblaze B2
    not_found_err = ClientError({"Error": {"Code": "404", "Message": "Not Found"}}, "HeadObject")
    mock_s3.head_object.side_effect = not_found_err
    with patch("app.services.storage.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "my-test-b2-bucket"):
            res_404 = client.get("/api/v1/discord/attachments/inexistente_b2.mp4", follow_redirects=False)
            assert res_404.status_code == 404


def test_get_discord_media_presigned_url_attachment_disposition():
    """Valida geração de URL pré-assinada forçando download para documentos (ex: PDF)."""
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://s3.us-west-004.backblazeb2.com/test?token=signed123"

    with patch("app.services.storage.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "my-test-b2-bucket"):
            url = get_discord_media_presigned_url("relatorio.pdf", content_disposition="attachment")
            assert url is not None
            params_used = mock_s3.generate_presigned_url.call_args[1]["Params"]
            assert params_used["ResponseContentDisposition"] == 'attachment; filename="relatorio.pdf"'


def test_delete_channel_message_physically_deletes_from_b2_and_local():
    """Valida que deletar mensagem de canal apaga fisicamente a mídia no Backblaze B2 e disco local."""
    _, email = get_or_create_user()
    headers = get_auth_header(email)

    res_srv = client.post("/api/v1/discord/servers", json={"name": "Servidor Delete Media"}, headers=headers)
    assert res_srv.status_code == 201
    channel_id = [c for c in res_srv.json()["channels"] if c["type"] == "TEXT"][0]["id"]

    # 1. Testa exclusão física em modo Backblaze B2
    mock_s3 = MagicMock()
    with patch("app.services.storage.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "my-test-b2-bucket"):
            files = {"file": ("video_aula.mp4", io.BytesIO(b"video-data-b2"), "video/mp4")}
            up_res = client.post(f"/api/v1/discord/channels/{channel_id}/attachments", files=files, headers=headers)
            assert up_res.status_code == 200
            att_url = up_res.json()["attachment_url"]
            fname = extract_managed_media_filename(att_url)
            assert not os.path.exists(os.path.join(DISCORD_UPLOAD_DIR, fname))

            msg_res = client.post(
                f"/api/v1/discord/channels/{channel_id}/messages",
                json={"content": "Vídeo B2", "attachment_url": att_url, "attachment_type": "video/mp4", "attachment_size": 13},
                headers=headers,
            )
            assert msg_res.status_code == 201
            msg_id = msg_res.json()["id"]

            del_res = client.delete(f"/api/v1/discord/channels/{channel_id}/messages/{msg_id}", headers=headers)
            assert del_res.status_code == 200
            mock_s3.delete_object.assert_called_once()
            assert fname in mock_s3.delete_object.call_args[1]["Key"]


def test_forwarded_message_preserves_media_until_last_copy_deleted():
    """Garante que mídias encaminhadas só são deletadas fisicamente quando a última mensagem é apagada."""
    _, email = get_or_create_user()
    headers = get_auth_header(email)

    res_srv = client.post("/api/v1/discord/servers", json={"name": "Servidor Forward RefCount"}, headers=headers)
    srv = res_srv.json()
    ch1_id = [c for c in srv["channels"] if c["type"] == "TEXT"][0]["id"]
    ch2_res = client.post(
        f"/api/v1/discord/servers/{srv['id']}/channels",
        json={"name": "arquivos", "type": "TEXT", "category": "Canais de Texto"},
        headers=headers,
    )
    ch2_id = ch2_res.json()["id"]

    with patch("app.services.storage.get_s3_client", return_value=None):
        up = client.post(
            f"/api/v1/discord/channels/{ch1_id}/attachments",
            files={"file": ("foto.png", io.BytesIO(b"png-bytes"), "image/png")},
            headers=headers,
        ).json()
        att_url = up["attachment_url"]
        local_file = os.path.join(DISCORD_UPLOAD_DIR, extract_managed_media_filename(att_url))
        assert os.path.exists(local_file)

        msg1 = client.post(
            f"/api/v1/discord/channels/{ch1_id}/messages",
            json={"content": "Original", "attachment_url": att_url, "attachment_type": "image/png", "attachment_size": 9},
            headers=headers,
        ).json()

        fwd = client.post(
            f"/api/v1/discord/channels/{ch1_id}/messages/{msg1['id']}/forward",
            json={"target_channel_id": ch2_id},
            headers=headers,
        ).json()

        # Apaga a original: cópia encaminhada ainda existe, arquivo físico DEVE permanecer
        client.delete(f"/api/v1/discord/channels/{ch1_id}/messages/{msg1['id']}", headers=headers)
        assert os.path.exists(local_file)

        # Apaga a encaminhada: 0 referências restantes, arquivo físico DEVE ser removido
        client.delete(f"/api/v1/discord/channels/{ch2_id}/messages/{fwd['id']}", headers=headers)
        assert not os.path.exists(local_file)


def test_delete_dm_message_and_delete_server_physically_clean_media():
    """Valida exclusão física de anexos ao apagar mensagem de DM e ao excluir um servidor inteiro."""
    u1_id, email1 = get_or_create_user("b2_dm_u1@teste.com", "DM User 1")
    u2_id, _ = get_or_create_user("b2_dm_u2@teste.com", "DM User 2")
    headers1 = get_auth_header(email1)

    db = TestingSessionLocal()
    try:
        conv = (
            db.query(DMConversation)
            .filter(DMConversation.user1_id == min(u1_id, u2_id), DMConversation.user2_id == max(u1_id, u2_id))
            .first()
        )
        if not conv:
            conv = DMConversation(user1_id=min(u1_id, u2_id), user2_id=max(u1_id, u2_id))
            db.add(conv)
            db.commit()
            db.refresh(conv)
        conv_id = conv.id
    finally:
        db.close()

    with patch("app.services.storage.get_s3_client", return_value=None):
        # 1. DM attachment + delete DM message
        dm_up = client.post(
            f"/api/v1/discord/dms/conversations/{conv_id}/attachments",
            files={"file": ("voz.ogg", io.BytesIO(b"ogg-dm-bytes"), "audio/ogg")},
            headers=headers1,
        ).json()
        dm_file = os.path.join(DISCORD_UPLOAD_DIR, extract_managed_media_filename(dm_up["attachment_url"]))
        assert os.path.exists(dm_file)

        dm_msg = client.post(
            f"/api/v1/discord/dms/conversations/{conv_id}/messages",
            json={"content": "", "attachment_url": dm_up["attachment_url"], "attachment_type": "audio/ogg", "attachment_size": 12},
            headers=headers1,
        ).json()

        del_dm = client.delete(f"/api/v1/discord/dms/messages/{dm_msg['id']}", headers=headers1)
        assert del_dm.status_code == 200
        assert not os.path.exists(dm_file)

        # 2. Server com ícone + anexo de mensagem -> excluir servidor apaga ambos fisicamente
        srv = client.post("/api/v1/discord/servers", json={"name": "Servidor Full Cleanup"}, headers=headers1).json()
        srv_id = srv["id"]
        ch_id = [c for c in srv["channels"] if c["type"] == "TEXT"][0]["id"]

        icon_res = client.post(
            f"/api/v1/discord/servers/{srv_id}/icon",
            files={"file": ("icon.png", io.BytesIO(b"\x89PNG\r\n\x1a\nicon"), "image/png")},
            headers=headers1,
        ).json()
        icon_file = os.path.join(DISCORD_UPLOAD_DIR, extract_managed_media_filename(icon_res["icon_url"]))

        ch_up = client.post(
            f"/api/v1/discord/channels/{ch_id}/attachments",
            files={"file": ("clip.webm", io.BytesIO(b"webm-bytes"), "video/webm")},
            headers=headers1,
        ).json()
        clip_file = os.path.join(DISCORD_UPLOAD_DIR, extract_managed_media_filename(ch_up["attachment_url"]))
        client.post(
            f"/api/v1/discord/channels/{ch_id}/messages",
            json={"content": "Clip", "attachment_url": ch_up["attachment_url"], "attachment_type": "video/webm", "attachment_size": 10},
            headers=headers1,
        )

        assert os.path.exists(icon_file)
        assert os.path.exists(clip_file)

        del_srv = client.delete(f"/api/v1/discord/servers/{srv_id}", headers=headers1)
        assert del_srv.status_code == 200
        assert not os.path.exists(icon_file)
        assert not os.path.exists(clip_file)

"""
Testes unitários para o Módulo de Gravações de Canais de Voz integradas ao Backblaze B2.
"""
import io
from datetime import datetime, timezone
import pytest
from unittest.mock import patch, MagicMock
from app.core.config import settings
from conftest import client, TestingSessionLocal
from app.models.user import User
from app.models.discord import Server, Channel, ServerMember, VoiceRecording
from app.core.security import get_password_hash


def create_user(email: str, name: str, role: str = "user") -> int:
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        u = User(
            email=email,
            name=name,
            hashed_password=get_password_hash("SenhaForte123!@"),
            role=role,
            is_active=True,
            max_servers=100,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        uid = u.id
    else:
        existing.role = role
        db.commit()
        uid = existing.id
    db.close()
    return uid


def get_auth_token(email: str):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "SenhaForte123!@"})
    assert res.status_code == 200, res.text
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def setup_voice_scenario():
    """Cria um servidor, um canal de voz, um canal de texto e 3 usuários: Owner/Admin, Membro Normal A e Membro Normal B."""
    db = TestingSessionLocal()
    owner_id = create_user("owner_rec@teste.com", "Servidor Owner", "user")
    user_a_id = create_user("member_a_rec@teste.com", "Membro A", "user")
    user_b_id = create_user("member_b_rec@teste.com", "Membro B", "user")
    super_id = create_user("super_rec@teste.com", "Super Admin", "SUPER_ADMIN")

    server = Server(name="Servidor Gravações", owner_id=owner_id)
    db.add(server)
    db.commit()
    db.refresh(server)

    # Membros
    db.add(ServerMember(server_id=server.id, user_id=owner_id, role="OWNER"))
    db.add(ServerMember(server_id=server.id, user_id=user_a_id, role="MEMBER"))
    db.add(ServerMember(server_id=server.id, user_id=user_b_id, role="MEMBER"))

    voice_chan = Channel(server_id=server.id, name="Voz Gravação", type="VOICE", position=0)
    text_chan = Channel(server_id=server.id, name="Texto Geral", type="TEXT", position=1)
    db.add(voice_chan)
    db.add(text_chan)
    db.commit()
    db.refresh(voice_chan)
    db.refresh(text_chan)

    data = {
        "server_id": server.id,
        "voice_channel_id": voice_chan.id,
        "text_channel_id": text_chan.id,
        "owner_id": owner_id,
        "user_a_id": user_a_id,
        "user_b_id": user_b_id,
        "super_id": super_id,
    }
    db.close()
    return data


def test_upload_recording_to_voice_channel_b2_zero_hd(setup_voice_scenario):
    """Valida upload de vídeo de gravação para o Backblaze B2 sem ocupar o HD do servidor."""
    sc = setup_voice_scenario
    headers_a = get_auth_token("member_a_rec@teste.com")

    fake_video = io.BytesIO(b"fake-mp4-video-stream-content-12345")
    mock_s3 = MagicMock()

    with patch("app.services.storage.get_s3_client", return_value=mock_s3), patch("app.api.v1.endpoints.discord_recordings.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "nexus-recordings-bucket"):
            res = client.post(
                f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings",
                headers=headers_a,
                files={"file": ("reuniao.mp4", fake_video, "video/mp4")},
                data={
                    "title": "Reunião de Alinhamento Semanal",
                    "record_type": "video",
                    "duration_seconds": "125",
                },
            )

    assert res.status_code == 201, res.text
    data = res.json()
    assert data["title"] == "Reunião de Alinhamento Semanal"
    assert data["record_type"] == "video"
    assert data["duration_seconds"] == 125
    assert data["storage"] == "b2"
    assert "stream_url" in data
    assert "download_url" in data

    # Verifica se enviou diretamente para o bucket B2
    mock_s3.put_object.assert_called_once()
    call_kwargs = mock_s3.put_object.call_args[1]
    assert call_kwargs["Bucket"] == "nexus-recordings-bucket"
    assert call_kwargs["Key"].startswith("discord_media/rec_")


def test_upload_recording_rejected_for_text_channel(setup_voice_scenario):
    """Valida que envio de gravação em canal de texto é rejeitado com 400 Bad Request."""
    sc = setup_voice_scenario
    headers_a = get_auth_token("member_a_rec@teste.com")

    fake_video = io.BytesIO(b"fake-data")
    res = client.post(
        f"/api/v1/discord/channels/{sc['text_channel_id']}/recordings",
        headers=headers_a,
        files={"file": ("test.mp4", fake_video, "video/mp4")},
        data={"title": "Tentativa Invalida"},
    )
    assert res.status_code == 400
    assert "exclusivo" in res.json()["detail"].lower() or "voz" in res.json()["detail"].lower()


def test_recordings_list_access_control(setup_voice_scenario):
    """
    Valida regra de privacidade:
    - Membro A vê apenas as gravações feitas por ele.
    - Membro B não vê as gravações do Membro A.
    - Owner/Admin e Super Admin veem todas as gravações.
    """
    sc = setup_voice_scenario
    headers_a = get_auth_token("member_a_rec@teste.com")
    headers_b = get_auth_token("member_b_rec@teste.com")
    headers_owner = get_auth_token("owner_rec@teste.com")
    headers_super = get_auth_token("super_rec@teste.com")

    mock_s3 = MagicMock()
    with patch("app.services.storage.get_s3_client", return_value=mock_s3), patch("app.api.v1.endpoints.discord_recordings.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "nexus-recordings-bucket"):
            # Membro A cria gravação
            res_a = client.post(
                f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings",
                headers=headers_a,
                files={"file": ("video_a.mp4", io.BytesIO(b"video-a"), "video/mp4")},
                data={"title": "Gravação Privada do Membro A"},
            )
            assert res_a.status_code == 201

    # Membro A lista gravações: deve conter a sua
    list_a = client.get(f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings", headers=headers_a)
    assert list_a.status_code == 200
    titles_a = [r["title"] for r in list_a.json()]
    assert "Gravação Privada do Membro A" in titles_a

    # Membro B lista gravações: NÃO deve ver a do Membro A
    list_b = client.get(f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings", headers=headers_b)
    assert list_b.status_code == 200
    titles_b = [r["title"] for r in list_b.json()]
    assert "Gravação Privada do Membro A" not in titles_b

    # Owner lista gravações: DEVE ver todas as gravações
    list_owner = client.get(f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings", headers=headers_owner)
    assert list_owner.status_code == 200
    titles_owner = [r["title"] for r in list_owner.json()]
    assert "Gravação Privada do Membro A" in titles_owner

    # Super Admin lista gravações: DEVE ver todas as gravações
    list_super = client.get(f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings", headers=headers_super)
    assert list_super.status_code == 200
    titles_super = [r["title"] for r in list_super.json()]
    assert "Gravação Privada do Membro A" in titles_super


def test_rename_recording(setup_voice_scenario):
    """
    Valida renomeação do título da gravação:
    - Autor e Admin conseguem renomear.
    - Outro membro sem privilégio recebe 403 Forbidden.
    """
    sc = setup_voice_scenario
    headers_a = get_auth_token("member_a_rec@teste.com")
    headers_b = get_auth_token("member_b_rec@teste.com")
    headers_owner = get_auth_token("owner_rec@teste.com")

    mock_s3 = MagicMock()
    with patch("app.services.storage.get_s3_client", return_value=mock_s3), patch("app.api.v1.endpoints.discord_recordings.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "nexus-recordings-bucket"):
            res = client.post(
                f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings",
                headers=headers_a,
                files={"file": ("video.mp4", io.BytesIO(b"video-bytes"), "video/mp4")},
                data={"title": "Título Original"},
            )
    rec_id = res.json()["id"]

    # Membro B tenta renomear gravação do Membro A -> 403
    res_b = client.patch(f"/api/v1/discord/recordings/{rec_id}", headers=headers_b, json={"title": "Hackeado"})
    assert res_b.status_code == 403

    # Membro A (Autor) renomeia com sucesso
    res_renamed = client.patch(f"/api/v1/discord/recordings/{rec_id}", headers=headers_a, json={"title": "Título Atualizado pelo Autor"})
    assert res_renamed.status_code == 200
    assert res_renamed.json()["title"] == "Título Atualizado pelo Autor"

    # Owner do servidor também consegue renomear
    res_owner_rename = client.patch(f"/api/v1/discord/recordings/{rec_id}", headers=headers_owner, json={"title": "Revisado pela Coordenação"})
    assert res_owner_rename.status_code == 200
    assert res_owner_rename.json()["title"] == "Revisado pela Coordenação"


def test_delete_recording_physical_b2_removal(setup_voice_scenario):
    """
    Valida exclusão da gravação:
    - Membro sem permissão é bloqueado com 403.
    - Autor/Admin exclui: gravação é removida do banco e s3.delete_object é acionado no Backblaze B2.
    """
    sc = setup_voice_scenario
    headers_a = get_auth_token("member_a_rec@teste.com")
    headers_b = get_auth_token("member_b_rec@teste.com")

    mock_s3 = MagicMock()
    with patch("app.services.storage.get_s3_client", return_value=mock_s3), patch("app.api.v1.endpoints.discord_recordings.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "nexus-recordings-bucket"):
            res = client.post(
                f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings",
                headers=headers_a,
                files={"file": ("clip.mp4", io.BytesIO(b"clip-bytes"), "video/mp4")},
                data={"title": "Para Deletar"},
            )
            rec_id = res.json()["id"]
            rec_filename = res.json()["filename"]

            # Membro B tenta deletar gravação do Membro A -> 403
            res_forbidden = client.delete(f"/api/v1/discord/recordings/{rec_id}", headers=headers_b)
            assert res_forbidden.status_code == 403

            # Membro A deleta
            res_del = client.delete(f"/api/v1/discord/recordings/{rec_id}", headers=headers_a)
            assert res_del.status_code == 200
            assert res_del.json()["status"] == "deleted"

            # Confirma que s3.delete_object foi invocado para deletar fisicamente do Backblaze B2
            mock_s3.delete_object.assert_called_once()
            call_kwargs = mock_s3.delete_object.call_args[1]
            assert call_kwargs["Bucket"] == "nexus-recordings-bucket"
            assert rec_filename in call_kwargs["Key"]

    # Confirma que sumiu do banco de dados (404 se tentar deletar de novo)
    res_404 = client.delete(f"/api/v1/discord/recordings/{rec_id}", headers=headers_a)
    assert res_404.status_code == 404


def test_stream_and_download_recording_with_token_query(setup_voice_scenario):
    """
    Valida reprodução inline (streaming) e download autenticado via query parameter ?token=
    (necessário para tags HTML nativas <audio> e <video> que não suportam headers customizados).
    """
    sc = setup_voice_scenario
    headers_a = get_auth_token("member_a_rec@teste.com")
    token_str = headers_a["Authorization"].split(" ")[1]

    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://b2.backblazeb2.com/signed-stream-url"

    with patch("app.services.storage.get_s3_client", return_value=mock_s3), patch("app.api.v1.endpoints.discord_recordings.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "nexus-recordings-bucket"):
            # Cria gravação de áudio
            res = client.post(
                f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings",
                headers=headers_a,
                files={"file": ("audio_stream.webm", io.BytesIO(b"audio-bytes-data"), "audio/webm")},
                data={"title": "Podcast da Sala", "record_type": "audio"},
            )
            assert res.status_code == 201
            rec_id = res.json()["id"]

            # Requisição sem token -> 401
            res_no_auth = client.get(f"/api/v1/discord/recordings/{rec_id}/stream", follow_redirects=False)
            assert res_no_auth.status_code == 401

            # Requisição de streaming com ?token= -> 307 Redirect para URL presigned do B2 com ResponseContentType correto
            res_stream = client.get(f"/api/v1/discord/recordings/{rec_id}/stream?token={token_str}", follow_redirects=False)
            assert res_stream.status_code == 307
            assert res_stream.headers["location"] == "https://b2.backblazeb2.com/signed-stream-url"

            # Requisição de download com ?token= -> 307 Redirect para URL presigned do B2
            res_download = client.get(f"/api/v1/discord/recordings/{rec_id}/download?token={token_str}", follow_redirects=False)
            assert res_download.status_code == 307


def test_batch_delete_recordings_success(setup_voice_scenario):
    """
    Valida a exclusão em massa de múltiplas gravações selecionadas de um canal,
    removendo fisicamente os arquivos do Backblaze B2 e excluindo do banco de dados.
    """
    sc = setup_voice_scenario
    headers_a = get_auth_token("member_a_rec@teste.com")
    mock_s3 = MagicMock()

    with patch("app.services.storage.get_s3_client", return_value=mock_s3), patch("app.api.v1.endpoints.discord_recordings.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "nexus-recordings-bucket"):
            # Cria 3 gravações
            ids = []
            for i in range(1, 4):
                res = client.post(
                    f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings",
                    headers=headers_a,
                    files={"file": (f"rec_{i}.webm", io.BytesIO(b"audio-data"), "audio/webm")},
                    data={"title": f"Gravação em Lote {i}", "record_type": "audio"},
                )
                assert res.status_code == 201
                ids.append(res.json()["id"])

            # Exclui 2 em lote
            batch_payload = {"recording_ids": [ids[0], ids[1]]}
            res_batch = client.post(
                f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings/batch-delete",
                headers=headers_a,
                json=batch_payload,
            )
            assert res_batch.status_code == 200
            data = res_batch.json()
            assert data["count"] == 2
            assert ids[0] in data["deleted_ids"]
            assert ids[1] in data["deleted_ids"]

            # Confirma que foram chamadas 2 exclusões no S3
            assert mock_s3.delete_object.call_count == 2

            # Confirma que a terceira gravação ainda existe na lista do canal
            res_list = client.get(f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings", headers=headers_a)
            remaining_ids = [r["id"] for r in res_list.json()]
            assert ids[2] in remaining_ids
            assert ids[0] not in remaining_ids
            assert ids[1] not in remaining_ids


def test_list_and_batch_delete_server_recordings(setup_voice_scenario):
    """
    Valida a listagem de gravações a nível de servidor e exclusão em lote no servidor.
    - Owner/Admin e Super Admin veem todas as gravações do servidor e os nomes dos canais.
    - Membros comuns veem apenas suas próprias gravações.
    - Usuário não-membro recebe 403 Forbidden.
    """
    sc = setup_voice_scenario
    headers_owner = get_auth_token("owner_rec@teste.com")
    headers_a = get_auth_token("member_a_rec@teste.com")
    headers_b = get_auth_token("member_b_rec@teste.com")
    mock_s3 = MagicMock()

    with patch("app.services.storage.get_s3_client", return_value=mock_s3), patch("app.api.v1.endpoints.discord_recordings.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "nexus-recordings-bucket"):
            # Membro A cria 1 gravação
            res_a = client.post(
                f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings",
                headers=headers_a,
                files={"file": ("rec_a.webm", io.BytesIO(b"audio-a"), "audio/webm")},
                data={"title": "Gravação do Membro A", "record_type": "audio"},
            )
            assert res_a.status_code == 201
            rec_a_id = res_a.json()["id"]

            # Membro B cria 1 gravação
            res_b = client.post(
                f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings",
                headers=headers_b,
                files={"file": ("rec_b.webm", io.BytesIO(b"audio-b"), "audio/webm")},
                data={"title": "Gravação do Membro B", "record_type": "audio"},
            )
            assert res_b.status_code == 201
            rec_b_id = res_b.json()["id"]

            # 1. Owner vê AMBAS as gravações do servidor e o channel_name preenchido
            res_srv_owner = client.get(f"/api/v1/discord/servers/{sc['server_id']}/recordings", headers=headers_owner)
            assert res_srv_owner.status_code == 200
            owner_recs = res_srv_owner.json()
            owner_rec_ids = [r["id"] for r in owner_recs]
            assert rec_a_id in owner_rec_ids
            assert rec_b_id in owner_rec_ids
            # channel_name deve ser o nome do canal de voz
            found_rec_a = next(r for r in owner_recs if r["id"] == rec_a_id)
            assert found_rec_a["channel_name"] == "Voz Gravação"

            # 2. Membro A vê apenas sua própria gravação
            res_srv_a = client.get(f"/api/v1/discord/servers/{sc['server_id']}/recordings", headers=headers_a)
            assert res_srv_a.status_code == 200
            a_recs = res_srv_a.json()
            a_rec_ids = [r["id"] for r in a_recs]
            assert rec_a_id in a_rec_ids
            assert rec_b_id not in a_rec_ids

            # 3. Usuário de fora do servidor tenta listar e recebe 403
            outside_uid = create_user("outsider_rec@teste.com", "Forasteiro", "user")
            headers_outsider = get_auth_token("outsider_rec@teste.com")
            res_outside = client.get(f"/api/v1/discord/servers/{sc['server_id']}/recordings", headers=headers_outsider)
            assert res_outside.status_code == 403

            # 4. Exclusão em lote a nível de servidor pelo Owner
            res_batch = client.post(
                f"/api/v1/discord/servers/{sc['server_id']}/recordings/batch-delete",
                headers=headers_owner,
                json={"recording_ids": [rec_a_id, rec_b_id]},
            )
            assert res_batch.status_code == 200
            assert res_batch.json()["count"] == 2


def test_list_recordings_filters(setup_voice_scenario):
    """Valida filtros de gravações: por canal, por autor, somente admins e por data."""
    sc = setup_voice_scenario
    headers_owner = get_auth_token("owner_rec@teste.com")
    headers_a = get_auth_token("member_a_rec@teste.com")

    mock_s3 = MagicMock()
    with patch("app.services.storage.get_s3_client", return_value=mock_s3), patch("app.api.v1.endpoints.discord_recordings.get_s3_client", return_value=mock_s3):
        with patch.object(settings, "B2_BUCKET_NAME", "nexus-recordings-bucket"):
            # 1. Owner grava no canal de voz
            res_owner = client.post(
                f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings",
                headers=headers_owner,
                files={"file": ("admin_call.mp4", io.BytesIO(b"admin-video"), "video/mp4")},
                data={"title": "Gravação da Diretoria"},
            )
            assert res_owner.status_code == 201

            # 2. Membro A grava no canal de voz
            res_a = client.post(
                f"/api/v1/discord/channels/{sc['voice_channel_id']}/recordings",
                headers=headers_a,
                files={"file": ("member_call.mp4", io.BytesIO(b"member-video"), "video/mp4")},
                data={"title": "Gravação de Dúvidas"},
            )
            assert res_a.status_code == 201

            # Filtro only_admins=True: deve retornar apenas do Owner
            res_admins = client.get(
                f"/api/v1/discord/servers/{sc['server_id']}/recordings?only_admins=true",
                headers=headers_owner,
            )
            assert res_admins.status_code == 200
            data_admins = res_admins.json()
            assert all(item["is_admin_author"] is True for item in data_admins)
            assert any(item["title"] == "Gravação da Diretoria" for item in data_admins)
            assert not any(item["title"] == "Gravação de Dúvidas" for item in data_admins)

            # Filtro author_id=User A
            res_author = client.get(
                f"/api/v1/discord/servers/{sc['server_id']}/recordings?author_id={sc['user_a_id']}",
                headers=headers_owner,
            )
            assert res_author.status_code == 200
            assert all(item["user_id"] == sc["user_a_id"] for item in res_author.json())

            # Filtro channel_id
            res_ch = client.get(
                f"/api/v1/discord/servers/{sc['server_id']}/recordings?channel_id={sc['voice_channel_id']}",
                headers=headers_owner,
            )
            assert res_ch.status_code == 200
            assert all(item["channel_id"] == sc["voice_channel_id"] for item in res_ch.json())

            # Filtro target_date
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            res_date = client.get(
                f"/api/v1/discord/servers/{sc['server_id']}/recordings?target_date={today_str}",
                headers=headers_owner,
            )
            assert res_date.status_code == 200
            assert len(res_date.json()) >= 2



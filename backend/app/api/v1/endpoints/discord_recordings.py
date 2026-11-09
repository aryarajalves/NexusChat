"""
Rotas para Gerenciamento de Gravações de Canais de Voz e Vídeo integradas ao Backblaze B2.
"""
import os
import uuid
from datetime import datetime, time, timezone
from typing import List, Optional, Set
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header, Query, status
from fastapi.responses import RedirectResponse, FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logger import logger
from app.core.security import decode_access_token
from app.models.user import User
from app.models.discord import Channel, Server, ServerMember, VoiceRecording
from app.schemas.discord import (
    VoiceRecordingResponse,
    VoiceRecordingUpdate,
    VoiceRecordingsBatchDeleteRequest,
    VoiceRecordingsBatchDeleteResponse,
)
from app.api.v1.endpoints.users import get_current_user
from app.services.discord_permissions import ensure_channel_access, ensure_server_access
from app.services.storage import (
    upload_discord_media_file,
    delete_discord_media_file,
    resolve_discord_media_delivery,
    get_discord_media_file_path,
    get_discord_media_presigned_url,
    get_s3_client,
)
from app.core.config import settings

router = APIRouter(prefix="/discord", tags=["discord-recordings"])

ALLOWED_RECORDING_TYPES = {"video", "audio"}
ALLOWED_EXTENSIONS = {".mp4", ".webm", ".ogg", ".wav", ".m4a"}


def get_current_user_from_header_or_query(
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """Permite autenticar tanto via header 'Authorization: Bearer' quanto via query param '?token=' (para tags nativas de áudio/vídeo)."""
    raw_token = None
    if authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ")[1]
    elif token:
        raw_token = token.strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação não fornecido",
        )

    payload = decode_access_token(raw_token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
        )

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário inativo ou não encontrado",
        )
    return user


def _check_is_user_authorized(
    user: User,
    server: Server,
    db: Session,
    recording: Optional[VoiceRecording] = None,
) -> bool:
    """
    Verifica se o usuário tem privilégio de ver/editar/deletar a gravação:
    - Super Admin do sistema sempre tem acesso total.
    - Dono do servidor (owner_id) sempre tem acesso total.
    - Administradores do servidor (role='OWNER' ou 'ADMIN' ou cargo com is_admin) têm acesso total.
    - O próprio autor da gravação (user_id == recording.user_id) tem acesso à sua própria gravação.
    """
    # 1. Super Admin
    if getattr(user, "is_superuser", False) or getattr(user, "role", "") == "SUPER_ADMIN":
        return True

    # 2. Dono do Servidor
    if server and server.owner_id == user.id:
        return True

    # 3. Administradores do Servidor
    member = (
        db.query(ServerMember)
        .filter(ServerMember.server_id == server.id, ServerMember.user_id == user.id)
        .first()
    )
    if member:
        if member.role in ["OWNER", "ADMIN"]:
            return True
        if member.custom_role and member.custom_role.is_admin:
            return True

    # 4. Autor da Gravação
    if recording and recording.user_id == user.id:
        return True

    return False


def _get_server_admin_ids(server: Server, db: Session) -> Set[int]:
    """Retorna o conjunto de IDs de todos os usuários administradores ou donos do servidor."""
    admin_ids = set()
    if not server:
        return admin_ids
    if server.owner_id:
        admin_ids.add(server.owner_id)

    members = (
        db.query(ServerMember)
        .filter(ServerMember.server_id == server.id)
        .all()
    )
    for m in members:
        if m.role in ["OWNER", "ADMIN"]:
            admin_ids.add(m.user_id)
        elif m.custom_role and getattr(m.custom_role, "is_admin", False):
            admin_ids.add(m.user_id)

    superusers = (
        db.query(User.id)
        .filter(User.role.in_(["SUPER_ADMIN", "superadmin"]))
        .all()
    )
    for su in superusers:
        admin_ids.add(su[0])

    return admin_ids


def _build_recording_response(
    recording: VoiceRecording, is_admin_author: bool = False
) -> VoiceRecordingResponse:
    author_name = recording.user.name if recording.user else "Usuário"
    channel_name = recording.channel.name if recording.channel else None
    dt = recording.created_at
    if dt and dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)

    return VoiceRecordingResponse(
        id=recording.id,
        server_id=recording.server_id,
        channel_id=recording.channel_id,
        channel_name=channel_name,
        user_id=recording.user_id,
        author_name=author_name,
        is_admin_author=is_admin_author,
        title=recording.title,
        filename=recording.filename,
        storage=recording.storage,
        file_size=recording.file_size,
        duration_seconds=recording.duration_seconds,
        record_type=recording.record_type,
        stream_url=f"/api/v1/discord/recordings/{recording.id}/stream",
        download_url=f"/api/v1/discord/recordings/{recording.id}/download",
        created_at=dt,
    )


@router.post("/channels/{channel_id}/recordings", response_model=VoiceRecordingResponse, status_code=status.HTTP_201_CREATED)
async def upload_channel_recording(
    channel_id: int,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    record_type: str = Form("video"),
    duration_seconds: int = Form(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Faz upload de gravação diretamente para o Backblaze B2 (Zero HD no servidor).
    Vincula os metadados ao servidor e canal de voz.
    """
    channel = ensure_channel_access(channel_id, current_user, db)
    if channel.type != "VOICE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gravações são suportadas apenas em canais de voz.",
        )

    clean_record_type = record_type.strip().lower() if record_type else "video"
    if clean_record_type not in ALLOWED_RECORDING_TYPES:
        clean_record_type = "video"

    orig_filename = file.filename or ("gravacao.mp4" if clean_record_type == "video" else "gravacao.webm")
    _, ext = os.path.splitext(orig_filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".mp4" if clean_record_type == "video" else ".webm"

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O arquivo de gravação enviado está vazio.",
        )

    # 100 MB de limite de gravação por padrão
    max_size = 100 * 1024 * 1024
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="A gravação excede o limite máximo permitido de 100 MB.",
        )

    unique_id = uuid.uuid4().hex[:12]
    safe_filename = f"rec_{channel.server_id}_{channel_id}_{unique_id}{ext}"
    content_type = file.content_type or ("video/mp4" if ext == ".mp4" else "video/webm")

    # Envia para a nuvem Backblaze B2 diretamente da RAM (Zero HD)
    storage_result = upload_discord_media_file(
        file_bytes=file_bytes,
        filename=safe_filename,
        content_type=content_type,
    )

    clean_title = (title or "").strip()
    if not clean_title:
        clean_title = f"Gravação #{channel.name}"

    recording = VoiceRecording(
        server_id=channel.server_id,
        channel_id=channel.id,
        user_id=current_user.id,
        title=clean_title,
        filename=safe_filename,
        s3_key=storage_result.get("s3_key"),
        storage=storage_result.get("storage", "b2"),
        file_size=len(file_bytes),
        duration_seconds=max(0, int(duration_seconds)),
        record_type=clean_record_type,
    )
    db.add(recording)
    db.commit()
    db.refresh(recording)

    logger.info(
        f"[Gravação] Usuário {current_user.id} ({current_user.name}) gravou {clean_record_type} "
        f"no canal {channel_id} salvo no B2: {safe_filename} ({len(file_bytes)} bytes)"
    )

    return _build_recording_response(recording)


@router.get("/channels/{channel_id}/recordings", response_model=List[VoiceRecordingResponse])
def list_channel_recordings(
    channel_id: int,
    author_id: Optional[int] = Query(None, description="Filtrar por autor/usuário específico"),
    only_admins: Optional[bool] = Query(False, description="Filtrar apenas vídeos gravados por administradores"),
    target_date: Optional[str] = Query(None, description="Filtrar por data específica (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lista as gravações do canal de voz com suporte a filtros por autor, administradores e data.
    Controle de acesso rigoroso:
    - Administradores, Dono do servidor e Super Admin veem todas as gravações do canal.
    - Membros comuns veem apenas as gravações feitas por eles mesmos.
    """
    channel = ensure_channel_access(channel_id, current_user, db)
    server = channel.server or db.query(Server).filter(Server.id == channel.server_id).first()

    is_privileged = _check_is_user_authorized(current_user, server, db, recording=None)
    admin_ids = _get_server_admin_ids(server, db) if server else set()

    query = db.query(VoiceRecording).filter(VoiceRecording.channel_id == channel.id)
    if not is_privileged:
        query = query.filter(VoiceRecording.user_id == current_user.id)

    if author_id is not None:
        query = query.filter(VoiceRecording.user_id == author_id)

    if only_admins:
        query = query.filter(VoiceRecording.user_id.in_(list(admin_ids) if admin_ids else [-1]))

    if target_date:
        try:
            dt_obj = datetime.strptime(target_date.strip(), "%Y-%m-%d").date()
            start_of_day = datetime.combine(dt_obj, time.min)
            end_of_day = datetime.combine(dt_obj, time.max)
            query = query.filter(VoiceRecording.created_at >= start_of_day, VoiceRecording.created_at <= end_of_day)
        except Exception:
            pass

    recordings = query.order_by(VoiceRecording.created_at.desc()).all()
    return [_build_recording_response(rec, is_admin_author=(rec.user_id in admin_ids)) for rec in recordings]


@router.get("/servers/{server_id}/recordings", response_model=List[VoiceRecordingResponse])
def list_server_recordings(
    server_id: int,
    channel_id: Optional[int] = Query(None, description="Filtrar por canal de voz específico"),
    author_id: Optional[int] = Query(None, description="Filtrar por autor/usuário específico"),
    only_admins: Optional[bool] = Query(False, description="Filtrar apenas vídeos gravados por administradores"),
    target_date: Optional[str] = Query(None, description="Filtrar por data específica (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lista todas as gravações dos canais do servidor com filtros de sala, autor, administradores e data.
    Controle de acesso rigoroso:
    - Administradores, Dono do servidor e Super Admin veem todas as gravações daquele servidor.
    - Membros comuns veem apenas as gravações feitas por eles mesmos naquele servidor.
    - Usuários sem relação com o servidor recebem 403 Forbidden.
    """
    server = ensure_server_access(server_id, current_user, db)
    is_privileged = _check_is_user_authorized(current_user, server, db, recording=None)
    admin_ids = _get_server_admin_ids(server, db)

    query = db.query(VoiceRecording).filter(VoiceRecording.server_id == server.id)
    if not is_privileged:
        query = query.filter(VoiceRecording.user_id == current_user.id)

    if channel_id is not None:
        query = query.filter(VoiceRecording.channel_id == channel_id)

    if author_id is not None:
        query = query.filter(VoiceRecording.user_id == author_id)

    if only_admins:
        query = query.filter(VoiceRecording.user_id.in_(list(admin_ids) if admin_ids else [-1]))

    if target_date:
        try:
            dt_obj = datetime.strptime(target_date.strip(), "%Y-%m-%d").date()
            start_of_day = datetime.combine(dt_obj, time.min)
            end_of_day = datetime.combine(dt_obj, time.max)
            query = query.filter(VoiceRecording.created_at >= start_of_day, VoiceRecording.created_at <= end_of_day)
        except Exception:
            pass

    recordings = query.order_by(VoiceRecording.created_at.desc()).all()
    return [_build_recording_response(rec, is_admin_author=(rec.user_id in admin_ids)) for rec in recordings]


@router.patch("/recordings/{recording_id}", response_model=VoiceRecordingResponse)
def rename_recording(
    recording_id: int,
    payload: VoiceRecordingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Renomeia o título de exibição da gravação.
    Permitido apenas para o autor da gravação, Administradores do servidor e Super Admin.
    """
    recording = db.query(VoiceRecording).filter(VoiceRecording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gravação não encontrada.")

    server = db.query(Server).filter(Server.id == recording.server_id).first()
    if not _check_is_user_authorized(current_user, server, db, recording):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para renomear esta gravação.",
        )

    new_title = payload.title.strip()
    if not new_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O título não pode ser vazio.")

    recording.title = new_title
    db.commit()
    db.refresh(recording)

    logger.info(f"[Gravação] Usuário {current_user.id} renomeou gravação {recording_id} para '{new_title}'.")
    return _build_recording_response(recording)


@router.delete("/recordings/{recording_id}")
def delete_recording(
    recording_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Exclui a gravação do banco de dados e apaga fisicamente do Backblaze B2 (e disco local).
    Permitido apenas para o autor da gravação, Administradores do servidor e Super Admin.
    """
    recording = db.query(VoiceRecording).filter(VoiceRecording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gravação não encontrada.")

    server = db.query(Server).filter(Server.id == recording.server_id).first()
    if not _check_is_user_authorized(current_user, server, db, recording):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para excluir esta gravação.",
        )

    # Exclusão física no Backblaze B2 e qualquer cópia local residual
    delete_discord_media_file(recording.filename)

    db.delete(recording)
    db.commit()

    logger.info(f"[Gravação] Gravação {recording_id} ({recording.filename}) excluída do Backblaze B2 e banco de dados.")
    return {"status": "deleted", "id": recording_id}


@router.post("/channels/{channel_id}/recordings/batch-delete", response_model=VoiceRecordingsBatchDeleteResponse)
def batch_delete_channel_recordings(
    channel_id: int,
    payload: VoiceRecordingsBatchDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Exclui múltiplas gravações em lote do canal de voz, apagando fisicamente do Backblaze B2 e banco de dados.
    Verifica privilégios individualmente para cada gravação (ou privilégio de admin do canal/servidor).
    """
    channel = ensure_channel_access(channel_id, current_user, db)
    server = channel.server or db.query(Server).filter(Server.id == channel.server_id).first()

    if not payload.recording_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma gravação informada para exclusão.",
        )

    # Busca gravações deste canal correspondentes aos IDs recebidos
    recordings = (
        db.query(VoiceRecording)
        .filter(
            VoiceRecording.channel_id == channel.id,
            VoiceRecording.id.in_(payload.recording_ids),
        )
        .all()
    )

    if not recordings:
        return VoiceRecordingsBatchDeleteResponse(deleted_ids=[], count=0)

    deleted_ids = []
    for rec in recordings:
        # Validação de permissão por gravação
        if not _check_is_user_authorized(current_user, server, db, rec):
            logger.warning(
                f"[Gravação] Usuário {current_user.id} sem permissão para deletar gravação {rec.id} em lote."
            )
            continue

        try:
            # Apaga fisicamente do Backblaze B2 e disco local
            delete_discord_media_file(rec.filename)
            db.delete(rec)
            deleted_ids.append(rec.id)
        except Exception as err:
            logger.error(f"[Gravação] Falha ao deletar arquivo B2 da gravação {rec.id} ({rec.filename}): {err}")
            # Deleta do banco mesmo se a mídia remota já tiver sido removida
            db.delete(rec)
            deleted_ids.append(rec.id)

    db.commit()
    logger.info(
        f"[Gravação] Usuário {current_user.id} excluiu em lote {len(deleted_ids)} gravações do canal {channel_id}."
    )
    return VoiceRecordingsBatchDeleteResponse(deleted_ids=deleted_ids, count=len(deleted_ids))


@router.post("/servers/{server_id}/recordings/batch-delete", response_model=VoiceRecordingsBatchDeleteResponse)
def batch_delete_server_recordings(
    server_id: int,
    payload: VoiceRecordingsBatchDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Exclui múltiplas gravações selecionadas de um servidor em lote.
    Remove fisicamente do Backblaze B2 e do banco de dados.
    """
    server = ensure_server_access(server_id, current_user, db)

    recordings = (
        db.query(VoiceRecording)
        .filter(
            VoiceRecording.server_id == server.id,
            VoiceRecording.id.in_(payload.recording_ids),
        )
        .all()
    )

    if not recordings:
        return VoiceRecordingsBatchDeleteResponse(deleted_ids=[], count=0)

    deleted_ids = []
    for rec in recordings:
        if not _check_is_user_authorized(current_user, server, db, rec):
            logger.warning(
                f"[Gravação] Usuário {current_user.id} sem permissão para deletar gravação {rec.id} em lote no servidor {server_id}."
            )
            continue

        try:
            delete_discord_media_file(rec.filename)
            db.delete(rec)
            deleted_ids.append(rec.id)
        except Exception as err:
            logger.error(f"[Gravação] Falha ao deletar arquivo B2 da gravação {rec.id} ({rec.filename}): {err}")
            db.delete(rec)
            deleted_ids.append(rec.id)

    db.commit()
    logger.info(
        f"[Gravação] Usuário {current_user.id} excluiu em lote {len(deleted_ids)} gravações do servidor {server_id}."
    )
    return VoiceRecordingsBatchDeleteResponse(deleted_ids=deleted_ids, count=len(deleted_ids))



@router.get("/recordings/{recording_id}/stream")
def stream_recording(
    recording_id: int,
    current_user: User = Depends(get_current_user_from_header_or_query),
    db: Session = Depends(get_db),
):
    """
    Redireciona para URL pré-assinada do Backblaze B2 para reprodução inline no player.
    Suporta autenticação via header ou query param (?token=...).
    """
    recording = db.query(VoiceRecording).filter(VoiceRecording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gravação não encontrada.")

    server = db.query(Server).filter(Server.id == recording.server_id).first()
    if not _check_is_user_authorized(current_user, server, db, recording):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para reproduzir esta gravação.",
        )

    content_type = "video/mp4" if recording.record_type == "video" else "audio/webm"

    # 1. Se o arquivo estiver gravado no fallback local, serve diretamente com FileResponse
    local_path = get_discord_media_file_path(recording.filename)
    if recording.storage == "local" and local_path and os.path.exists(local_path):
        return FileResponse(local_path, media_type=content_type)

    # 2. Se Backblaze B2 configurado e gravação na nuvem, resolve entrega com presigned URL ou redirect
    delivery = resolve_discord_media_delivery(recording.filename, content_disposition="inline")
    if delivery:
        if delivery["mode"] == "redirect":
            return RedirectResponse(url=delivery["url"], status_code=status.HTTP_307_TEMPORARY_REDIRECT)
        elif delivery["mode"] == "local":
            return FileResponse(delivery["local_path"], media_type=content_type)

    # 3. Fallback de busca local caso o status no banco esteja diferente
    if local_path and os.path.exists(local_path):
        return FileResponse(local_path, media_type=content_type)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo de gravação não localizado na nuvem ou armazenamento local.")


@router.get("/recordings/{recording_id}/download")
def download_recording(
    recording_id: int,
    current_user: User = Depends(get_current_user_from_header_or_query),
    db: Session = Depends(get_db),
):
    """
    Gera download com o nome personalizado escolhido pelo usuário a partir do Backblaze B2.
    Suporta autenticação via header ou query param (?token=...).
    """
    recording = db.query(VoiceRecording).filter(VoiceRecording.id == recording_id).first()
    if not recording:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gravação não encontrada.")

    server = db.query(Server).filter(Server.id == recording.server_id).first()
    if not _check_is_user_authorized(current_user, server, db, recording):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para baixar esta gravação.",
        )

    _, ext = os.path.splitext(recording.filename)
    safe_title = "".join(c for c in recording.title if c.isalnum() or c in (" ", "-", "_")).strip()
    if not safe_title:
        safe_title = "gravacao"
    download_filename = f"{safe_title}{ext}"
    content_type = "video/mp4" if recording.record_type == "video" else "audio/webm"

    # 1. Se o arquivo estiver gravado localmente, serve diretamente o arquivo local para download
    local_path = get_discord_media_file_path(recording.filename)
    if recording.storage == "local" and local_path and os.path.exists(local_path):
        return FileResponse(local_path, filename=download_filename, media_type=content_type)

    s3 = get_s3_client()
    if s3 and settings.B2_BUCKET_NAME and recording.storage == "b2":
        s3_key = f"discord_media/{recording.filename}"
        try:
            url = s3.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": settings.B2_BUCKET_NAME,
                    "Key": s3_key,
                    "ResponseContentDisposition": f'attachment; filename="{download_filename}"',
                    "ResponseContentType": content_type,
                },
                ExpiresIn=3600,
            )
            return RedirectResponse(url=url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
        except Exception as err:
            logger.error(f"Erro ao gerar presigned url para download da gravação {recording_id}: {err}")

    # Fallback local
    delivery = resolve_discord_media_delivery(recording.filename)
    if delivery and delivery.get("mode") == "local":
        return FileResponse(delivery["local_path"], filename=download_filename, media_type=content_type)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo não encontrado para download.")

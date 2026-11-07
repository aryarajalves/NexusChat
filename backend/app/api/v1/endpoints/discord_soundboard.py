"""
Endpoints para Gerenciamento de Sons do Soundboard (Discord Voice Soundboard).
Permite listar, cadastrar (upload de áudio), excluir e disparar efeitos sonoros em canais de voz.
"""
import os
import re
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logger import logger
from app.models.user import User
from app.models.discord import Server, ServerMember, ServerRole, ServerSoundboardSound, Channel
from app.schemas.discord import ServerSoundboardSoundResponse, SoundboardPlayRequest
from app.api.v1.endpoints.users import get_current_user
from app.services.storage import upload_discord_media_file, delete_discord_media_file
from app.services.socket_manager import socket_manager

router = APIRouter(prefix="/discord", tags=["discord-soundboard"])

ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".webm", ".m4a"}
MAX_SOUND_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB (efeitos curtos de soundboard)


def ensure_server_member(server_id: int, current_user: User, db: Session) -> Server:
    """Valida se o servidor existe e se o usuário atual é membro dele ou superadmin."""
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servidor não encontrado.")

    if getattr(current_user, "role", "") == "superadmin" or getattr(current_user, "is_superuser", False):
        return server

    if server.owner_id == current_user.id:
        return server

    member = (
        db.query(ServerMember)
        .filter(ServerMember.server_id == server_id, ServerMember.user_id == current_user.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não é membro deste servidor.")

    return server


def ensure_can_manage_soundboard(server_id: int, current_user: User, db: Session) -> Server:
    """Valida se o usuário tem privilégio de Dono, Administrador ou Super Admin para gerenciar sons."""
    server = ensure_server_member(server_id, current_user, db)

    if getattr(current_user, "role", "") == "superadmin" or getattr(current_user, "is_superuser", False):
        return server

    if server.owner_id == current_user.id:
        return server

    member = (
        db.query(ServerMember)
        .filter(ServerMember.server_id == server_id, ServerMember.user_id == current_user.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão negada.")

    if member.role in ["OWNER", "ADMIN"]:
        return server

    if member.role_id:
        custom_role = db.query(ServerRole).filter(ServerRole.id == member.role_id).first()
        if custom_role and custom_role.is_admin:
            return server

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Apenas administradores do servidor podem adicionar ou remover sons do soundboard.",
    )


@router.get("/servers/{server_id}/soundboard", response_model=List[ServerSoundboardSoundResponse])
def list_server_sounds(
    server_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos os sons customizados do soundboard cadastrados no servidor."""
    ensure_server_member(server_id, current_user, db)
    sounds = (
        db.query(ServerSoundboardSound)
        .filter(ServerSoundboardSound.server_id == server_id)
        .order_by(ServerSoundboardSound.created_at.asc())
        .all()
    )
    return sounds


@router.post(
    "/servers/{server_id}/soundboard",
    response_model=ServerSoundboardSoundResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_server_sound(
    server_id: int,
    name: str = Form(...),
    emoji: str = Form("🔊"),
    volume: float = Form(1.0),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cadastra um novo som customizado de soundboard para o servidor."""
    ensure_can_manage_soundboard(server_id, current_user, db)

    clean_name = name.strip()
    if not clean_name or len(clean_name) < 2 or len(clean_name) > 32:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O nome do som deve ter entre 2 e 32 caracteres.",
        )

    clean_emoji = (emoji or "🔊").strip()[:16]

    # Validação de formato de áudio
    filename = file.filename or ""
    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de áudio não suportado ({ext}). Utilize MP3, WAV ou OGG.",
        )

    # Validação de unicidade no servidor
    existing = (
        db.query(ServerSoundboardSound)
        .filter(
            ServerSoundboardSound.server_id == server_id,
            ServerSoundboardSound.name.ilike(clean_name),
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Já existe um som com o nome '{clean_name}' neste servidor.",
        )

    # Leitura do buffer e validação de tamanho
    content = await file.read()
    if len(content) > MAX_SOUND_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O arquivo de som do soundboard excede o limite máximo de 2 MB.",
        )

    unique_name = f"sound_{uuid.uuid4().hex}{ext}"
    try:
        upload_res = upload_discord_media_file(content, unique_name, file.content_type)
        audio_url = upload_res["attachment_url"]
    except Exception as err:
        logger.error(f"Erro ao salvar arquivo de áudio do soundboard: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao processar o upload do arquivo de áudio.",
        )

    vol = max(0.1, min(float(volume or 1.0), 1.0))

    new_sound = ServerSoundboardSound(
        server_id=server_id,
        user_id=current_user.id,
        name=clean_name,
        emoji=clean_emoji,
        audio_url=audio_url,
        volume=vol,
    )
    db.add(new_sound)
    db.commit()
    db.refresh(new_sound)

    logger.info(
        f"Som '{clean_name}' cadastrado no servidor #{server_id} pelo usuário #{current_user.id} ({audio_url})"
    )
    return new_sound


@router.delete("/servers/{server_id}/soundboard/{sound_id}")
async def delete_server_sound(
    server_id: int,
    sound_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exclui um som customizado do soundboard."""
    ensure_can_manage_soundboard(server_id, current_user, db)

    sound = (
        db.query(ServerSoundboardSound)
        .filter(ServerSoundboardSound.id == sound_id, ServerSoundboardSound.server_id == server_id)
        .first()
    )
    if not sound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Som não encontrado.")

    # Exclusão física do arquivo de áudio
    try:
        delete_discord_media_file(sound.audio_url)
    except Exception as err:
        logger.warning(f"Não foi possível excluir fisicamente o arquivo do soundboard ({sound.audio_url}): {err}")

    db.delete(sound)
    db.commit()

    logger.info(f"Som #{sound_id} ('{sound.name}') excluído do servidor #{server_id}.")
    return {"message": "Som excluído com sucesso."}


@router.post("/channels/{channel_id}/soundboard/play")
async def play_soundboard_in_channel(
    channel_id: int,
    req: SoundboardPlayRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dispara um som para todos os membros conectados na sala de voz."""
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Canal não encontrado.")

    # Broadcast via WebSocket para todos os participantes do canal de voz
    payload = {
        "event": "voice:soundboard",
        "channel_id": channel_id,
        "user_id": current_user.id,
        "user_name": current_user.name,
        "sound": {
            "sound_id": req.sound_id,
            "sound_name": req.sound_name,
            "emoji": req.emoji or "🔊",
            "audio_url": req.audio_url,
            "volume": req.volume or 1.0,
        },
    }
    await socket_manager.broadcast_to_channel(channel_id, payload)
    return {"message": "Som reproduzido com sucesso.", "payload": payload}

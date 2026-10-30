from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.discord import Channel, ServerMember
from app.api.v1.endpoints.users import get_current_user
from app.services.livekit_service import get_livekit_voice_credentials
from app.services.socket_manager import socket_manager
from app.services.discord_permissions import ensure_channel_access

router = APIRouter(prefix="/discord/channels", tags=["discord-voice"])

def ensure_voice_channel_access(channel_id: int, user: User, db: Session) -> Channel:
    """Valida se o canal existe, se o usuário tem permissão de acesso e se é do tipo VOICE."""
    channel = ensure_channel_access(channel_id, user, db)

    if channel.type != "VOICE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este endpoint é exclusivo para canais de voz e transmissão."
        )

    return channel

@router.post("/{channel_id}/voice-token")
def get_voice_channel_token(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Gera um token de acesso SFU do LiveKit para conexão em alta escala na sala de voz.
    Permite transmissão de áudio, vídeo de webcam e compartilhamento de tela.
    """
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    credentials = get_livekit_voice_credentials(
        channel_id=channel.id,
        user_id=current_user.id,
        user_name=current_user.name
    )
    credentials["channel_name"] = channel.name
    credentials["server_id"] = channel.server_id
    return credentials

@router.get("/{channel_id}/voice-status")
def get_voice_channel_status(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Retorna os participantes ativos conectados no canal de voz."""
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    online_users = socket_manager.get_online_users_in_channel(channel.id)
    return {
        "channel_id": channel.id,
        "channel_name": channel.name,
        "active_participants": online_users,
        "total_participants": len(online_users),
        "sfu_enabled": True
    }

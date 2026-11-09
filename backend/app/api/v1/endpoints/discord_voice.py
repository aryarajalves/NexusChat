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
async def get_voice_channel_token(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Gera um token de acesso SFU do LiveKit para conexão em alta escala na sala de voz.
    Permite transmissão de áudio, vídeo de webcam e compartilhamento de tela.
    """
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    previous_channels = socket_manager.register_voice_user(
        channel.id, current_user.id, current_user.name, avatar_url=current_user.avatar_url
    )
    for prev_ch in previous_channels:
        prev_participants = socket_manager.get_voice_users_in_channel(prev_ch)
        await socket_manager.broadcast_to_channel(
            prev_ch,
            {
                "event": "presence:leave",
                "user_id": current_user.id,
                "user_name": current_user.name,
                "online_users": prev_participants,
            },
        )
        await socket_manager.broadcast_voice_channel_update(prev_ch)

    participants = socket_manager.get_voice_users_in_channel(channel.id)
    await socket_manager.broadcast_to_channel(
        channel.id,
        {
            "event": "presence:join",
            "user_id": current_user.id,
            "user_name": current_user.name,
            "online_users": participants,
        },
    )
    await socket_manager.broadcast_voice_channel_update(channel.id)
    credentials = get_livekit_voice_credentials(
        channel_id=channel.id,
        user_id=current_user.id,
        user_name=current_user.name
    )
    credentials["channel_name"] = channel.name
    credentials["server_id"] = channel.server_id
    return credentials

@router.post("/{channel_id}/voice-join")
async def join_voice_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Registra explicitamente a entrada do usuário na sessão do canal de voz."""
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    previous_channels = socket_manager.register_voice_user(
        channel.id, current_user.id, current_user.name, avatar_url=current_user.avatar_url
    )
    for prev_ch in previous_channels:
        prev_participants = socket_manager.get_voice_users_in_channel(prev_ch)
        await socket_manager.broadcast_to_channel(
            prev_ch,
            {
                "event": "presence:leave",
                "user_id": current_user.id,
                "user_name": current_user.name,
                "online_users": prev_participants,
            },
        )
        await socket_manager.broadcast_voice_channel_update(prev_ch)

    participants = socket_manager.get_voice_users_in_channel(channel.id)
    await socket_manager.broadcast_to_channel(
        channel.id,
        {
            "event": "presence:join",
            "user_id": current_user.id,
            "user_name": current_user.name,
            "online_users": participants
        }
    )
    await socket_manager.broadcast_voice_channel_update(channel.id)
    return {
        "status": "joined",
        "channel_id": channel.id,
        "active_participants": participants,
        "total_participants": len(participants),
        "call_started_at": socket_manager.get_call_started_at(channel.id)
    }

@router.post("/{channel_id}/voice-leave")
async def leave_voice_channel(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Registra a saída do usuário do canal de voz e notifica a sala."""
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    socket_manager.unregister_voice_user(channel.id, current_user.id)
    participants = socket_manager.get_voice_users_in_channel(channel.id)
    await socket_manager.broadcast_to_channel(
        channel.id,
        {
            "event": "presence:leave",
            "user_id": current_user.id,
            "user_name": current_user.name,
            "online_users": participants
        }
    )
    await socket_manager.broadcast_voice_channel_update(channel.id)
    return {
        "status": "left",
        "channel_id": channel.id,
        "active_participants": participants,
        "total_participants": len(participants),
        "call_started_at": socket_manager.get_call_started_at(channel.id)
    }

@router.post("/voice-leave-all")
async def leave_all_voice_channels(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Remove o usuário autenticado de todas as salas de voz (ex: logout ou fechamento da sessão)."""
    removed_channels = await socket_manager.remove_user_from_all_voice_rooms(
        current_user.id, current_user.name
    )
    return {
        "status": "cleared",
        "removed_channels": removed_channels,
    }

@router.get("/{channel_id}/voice-status")
def get_voice_channel_status(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Retorna os participantes ativos conectados no canal de voz e o tempo de call."""
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    online_users = socket_manager.get_voice_users_in_channel(channel.id)
    voice_states = {
        str(u.get("user_id")): {
            "is_muted": u.get("is_muted", True),
            "is_deafened": u.get("is_deafened", False),
            "is_speaking": u.get("is_speaking", False),
        }
        for u in online_users
        if u.get("user_id")
    }
    return {
        "channel_id": channel.id,
        "channel_name": channel.name,
        "active_participants": online_users,
        "voice_states": voice_states,
        "total_participants": len(online_users),
        "call_started_at": socket_manager.get_call_started_at(channel.id),
        "sfu_enabled": True
    }

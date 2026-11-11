from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.logger import logger
from app.models.user import User
from app.models.discord import Channel, Server, ServerMember, ServerRole
from app.schemas.discord import StageHandRaiseRequest, StageSpeakActionRequest
from app.api.v1.endpoints.users import get_current_user
from app.services.livekit_service import get_livekit_voice_credentials
from app.services.socket_manager import socket_manager
from app.services.discord_permissions import ensure_channel_access

router = APIRouter(prefix="/discord/channels", tags=["discord-voice"])

def ensure_voice_channel_access(channel_id: int, user: User, db: Session) -> Channel:
    """Valida se o canal existe, se o usuário tem permissão de acesso e se é do tipo VOICE ou STAGE."""
    channel = ensure_channel_access(channel_id, user, db)

    if channel.type not in ["VOICE", "STAGE"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este endpoint é exclusivo para canais de voz e palco/aula."
        )

    return channel

def is_stage_moderator(channel: Channel, user: User, db: Session) -> bool:
    """
    Verifica se o usuário possui cargo ou status de moderador/professor no canal de palco.
    - Super Admin do sistema
    - Dono do servidor
    - Membro com role OWNER ou ADMIN
    - Cargo com is_admin=True ou can_moderate_stage=True
    - Cargo com 'professor', 'instrutor' ou 'moderador' no nome
    """
    if getattr(user, "is_superuser", False) or getattr(user, "role", "") in ["superadmin", "SUPER_ADMIN"]:
        return True

    server = channel.server or db.query(Server).filter(Server.id == channel.server_id).first()
    if server and server.owner_id == user.id:
        return True

    member = db.query(ServerMember).filter(
        ServerMember.server_id == channel.server_id,
        ServerMember.user_id == user.id
    ).first()
    if not member:
        return False

    if member.role in ["OWNER", "ADMIN"]:
        return True

    if member.custom_role:
        if member.custom_role.is_admin:
            return True
        if getattr(member.custom_role, "can_moderate_stage", False):
            return True
        role_name = (member.custom_role.name or "").lower()
        if any(term in role_name for term in ["professor", "instrutor", "moderador", "prof", "admin"]):
            return True

    return False

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
    credentials["channel_type"] = channel.type
    credentials["server_id"] = channel.server_id
    is_stage = channel.type == "STAGE"
    is_mod = is_stage_moderator(channel, current_user, db) if is_stage else True
    is_speaker = True if not is_stage else (is_mod or current_user.id in socket_manager.get_stage_granted_speakers(channel.id))
    credentials["is_stage"] = is_stage
    credentials["is_moderator"] = is_mod
    credentials["is_speaker"] = is_speaker
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
    """Retorna os participantes ativos conectados no canal de voz ou palco e o tempo de call."""
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    online_users = socket_manager.get_voice_users_in_channel(channel.id)
    is_stage = channel.type == "STAGE"
    is_mod = is_stage_moderator(channel, current_user, db) if is_stage else True
    hands_raised = socket_manager.get_stage_hands_raised(channel.id) if is_stage else []
    granted_speakers = socket_manager.get_stage_granted_speakers(channel.id) if is_stage else []

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
        "channel_type": channel.type,
        "active_participants": online_users,
        "voice_states": voice_states,
        "total_participants": len(online_users),
        "call_started_at": socket_manager.get_call_started_at(channel.id),
        "sfu_enabled": True,
        "is_stage": is_stage,
        "is_moderator": is_mod,
        "hands_raised": hands_raised,
        "granted_speakers": granted_speakers,
    }


# --- Endpoints de Canal de Palco / Sala de Aula (Stage) ---

@router.get("/{channel_id}/stage/status")
def get_stage_status(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Retorna o estado detalhado do palco: moderadores, oradores, ouvintes e mãos levantadas."""
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    if channel.type != "STAGE":
        raise HTTPException(status_code=400, detail="Este canal não é do tipo Palco (STAGE).")

    online_users = socket_manager.get_voice_users_in_channel(channel.id)
    hands_raised = socket_manager.get_stage_hands_raised(channel.id)
    granted_speakers = socket_manager.get_stage_granted_speakers(channel.id)
    is_mod = is_stage_moderator(channel, current_user, db)

    participants = []
    for u in online_users:
        uid = u.get("user_id")
        user_obj = db.query(User).filter(User.id == uid).first() if uid else None
        u_is_mod = is_stage_moderator(channel, user_obj, db) if user_obj else False
        u_is_speaker = u_is_mod or (uid in granted_speakers)
        participants.append({
            "user_id": uid,
            "user_name": u.get("user_name"),
            "avatar_url": u.get("avatar_url"),
            "is_moderator": u_is_mod,
            "is_speaker": u_is_speaker,
            "hand_raised": uid in hands_raised,
            "is_muted": u.get("is_muted", True),
            "is_speaking": u.get("is_speaking", False),
        })

    return {
        "channel_id": channel.id,
        "is_stage": True,
        "current_user_is_moderator": is_mod,
        "hands_raised": hands_raised,
        "granted_speakers": granted_speakers,
        "participants": participants,
    }


@router.post("/{channel_id}/stage/raise-hand")
async def raise_stage_hand(
    channel_id: int,
    payload: StageHandRaiseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Permite ao aluno levantar ou abaixar a mão para pedir a palavra no palco."""
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    if channel.type != "STAGE":
        raise HTTPException(status_code=400, detail="Este canal não é do tipo Palco (STAGE).")

    is_hand_raised = socket_manager.raise_stage_hand(channel.id, current_user.id, payload.hand_raised)
    hands_raised = socket_manager.get_stage_hands_raised(channel.id)

    # Notifica todos na sala via WebSocket
    await socket_manager.broadcast_to_channel(
        channel.id,
        {
            "event": "stage:hand_updated",
            "channel_id": channel.id,
            "user_id": current_user.id,
            "user_name": current_user.name,
            "hand_raised": is_hand_raised,
            "hands_raised": hands_raised,
        }
    )

    logger.info(f"[Palco] Usuário {current_user.name} ({current_user.id}) {'levantou' if is_hand_raised else 'abaixou'} a mão no canal #{channel.id}")
    return {
        "status": "success",
        "channel_id": channel.id,
        "user_id": current_user.id,
        "hand_raised": is_hand_raised,
        "hands_raised": hands_raised,
    }


@router.post("/{channel_id}/stage/grant-speak")
async def grant_stage_speak(
    channel_id: int,
    payload: StageSpeakActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Concede permissão de fala ao aluno selecionado (exclusivo para moderadores/professores)."""
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    if channel.type != "STAGE":
        raise HTTPException(status_code=400, detail="Este canal não é do tipo Palco (STAGE).")

    if not is_stage_moderator(channel, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas moderadores e professores podem conceder a palavra.")

    socket_manager.grant_stage_speak(channel.id, payload.target_user_id)
    speakers = socket_manager.get_stage_granted_speakers(channel.id)
    hands_raised = socket_manager.get_stage_hands_raised(channel.id)

    # Notifica todos na sala via WebSocket
    await socket_manager.broadcast_to_channel(
        channel.id,
        {
            "event": "stage:speaker_granted",
            "channel_id": channel.id,
            "target_user_id": payload.target_user_id,
            "granted_by_id": current_user.id,
            "granted_by_name": current_user.name,
            "speakers": speakers,
            "hands_raised": hands_raised,
        }
    )

    logger.info(f"[Palco] Professor/Moderador {current_user.name} concedeu a palavra ao usuário {payload.target_user_id} no canal #{channel.id}")
    return {
        "status": "success",
        "channel_id": channel.id,
        "target_user_id": payload.target_user_id,
        "speakers": speakers,
        "hands_raised": hands_raised,
    }


@router.post("/{channel_id}/stage/revoke-speak")
async def revoke_stage_speak(
    channel_id: int,
    payload: StageSpeakActionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Revoga a permissão de fala do aluno e o muta novamente (exclusivo para moderadores/professores)."""
    channel = ensure_voice_channel_access(channel_id, current_user, db)
    if channel.type != "STAGE":
        raise HTTPException(status_code=400, detail="Este canal não é do tipo Palco (STAGE).")

    if not is_stage_moderator(channel, current_user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas moderadores e professores podem revogar a palavra.")

    socket_manager.revoke_stage_speak(channel.id, payload.target_user_id)
    speakers = socket_manager.get_stage_granted_speakers(channel.id)

    # Notifica todos na sala via WebSocket
    await socket_manager.broadcast_to_channel(
        channel.id,
        {
            "event": "stage:speaker_revoked",
            "channel_id": channel.id,
            "target_user_id": payload.target_user_id,
            "revoked_by_id": current_user.id,
            "revoked_by_name": current_user.name,
            "speakers": speakers,
        }
    )

    logger.info(f"[Palco] Professor/Moderador {current_user.name} revogou a palavra do usuário {payload.target_user_id} no canal #{channel.id}")
    return {
        "status": "success",
        "channel_id": channel.id,
        "target_user_id": payload.target_user_id,
        "speakers": speakers,
    }

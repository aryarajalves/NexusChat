from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logger import logger
from app.models.user import User
from app.models.discord import Channel, ServerMember, Message, DMConversation, DMMessage
from app.schemas.discord import MessageResponse, ReactionSummary
from app.api.v1.endpoints.users import get_current_user
from app.services.socket_manager import socket_manager

router = APIRouter(prefix="/discord", tags=["Discord Pinned Messages"])

MAX_PINS_PER_CHANNEL = 50


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def ensure_server_member(server_id: int, user_id: int, db: Session) -> ServerMember:
    member = db.query(ServerMember).filter(
        ServerMember.server_id == server_id,
        ServerMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não participa deste servidor"
        )
    return member


def ensure_dm_participant(conversation: DMConversation, user_id: int):
    if user_id not in (conversation.user1_id, conversation.user2_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado a esta conversa privada."
        )


def format_channel_message(msg: Message) -> MessageResponse:
    author_name = msg.author.name if msg.author else "Usuário"
    author_email = msg.author.email if msg.author else ""
    return MessageResponse(
        id=msg.id,
        channel_id=msg.channel_id,
        author_id=msg.author_id,
        author_name=author_name,
        author_email=author_email,
        content=msg.content or "",
        attachment_url=msg.attachment_url,
        attachment_type=msg.attachment_type,
        attachment_size=msg.attachment_size,
        reply_to_id=msg.reply_to_id,
        is_edited=msg.is_edited,
        is_pinned=bool(getattr(msg, "is_pinned", False)),
        reactions=[],
        created_at=ensure_utc(msg.created_at),
        updated_at=ensure_utc(msg.updated_at)
    )


def format_dm_message(msg: DMMessage) -> MessageResponse:
    author_name = msg.author.name if msg.author else "Usuário"
    author_email = msg.author.email if msg.author else ""
    return MessageResponse(
        id=msg.id,
        channel_id=msg.conversation_id,
        author_id=msg.author_id,
        author_name=author_name,
        author_email=author_email,
        content=msg.content or "",
        attachment_url=msg.attachment_url,
        attachment_type=msg.attachment_type,
        attachment_size=msg.attachment_size,
        reply_to_id=msg.reply_to_id,
        is_edited=msg.is_edited,
        is_pinned=bool(getattr(msg, "is_pinned", False)),
        reactions=[],
        created_at=ensure_utc(msg.created_at),
        updated_at=ensure_utc(msg.updated_at)
    )


# --- 1. MENSAGENS FIXADAS EM CANAIS DE SERVIDOR ---

@router.get("/channels/{channel_id}/pins", response_model=List[MessageResponse])
def list_channel_pinned_messages(
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal não encontrado")

    ensure_server_member(channel.server_id, current_user.id, db)

    pinned = db.query(Message).filter(
        Message.channel_id == channel_id,
        Message.is_pinned == True
    ).order_by(Message.id.desc()).all()

    return [format_channel_message(m) for m in pinned]


@router.patch("/channels/{channel_id}/messages/{message_id}/pin", response_model=MessageResponse)
async def toggle_pin_channel_message(
    channel_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal não encontrado")

    ensure_server_member(channel.server_id, current_user.id, db)

    message = db.query(Message).filter(
        Message.id == message_id,
        Message.channel_id == channel_id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")

    # Se vai fixar, verifica limite de mensagens fixadas por canal
    if not message.is_pinned:
        current_pins_count = db.query(Message).filter(
            Message.channel_id == channel_id,
            Message.is_pinned == True
        ).count()
        if current_pins_count >= MAX_PINS_PER_CHANNEL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Limite de {MAX_PINS_PER_CHANNEL} mensagens fixadas por canal atingido."
            )
        message.is_pinned = True
    else:
        message.is_pinned = False

    db.commit()
    db.refresh(message)

    resp = format_channel_message(message)

    # Broadcast via WebSocket para sincronizar todos os membros em tempo real
    await socket_manager.broadcast_to_channel(
        channel_id,
        {
            "event": "message:pin",
            "message_id": message.id,
            "is_pinned": message.is_pinned,
            "data": resp.model_dump(mode="json"),
            "message": resp.model_dump(mode="json"),
        }
    )

    action = "fixada" if message.is_pinned else "desafixada"
    logger.info(f"Mensagem {message_id} foi {action} no canal {channel_id} pelo usuário {current_user.id}")

    return resp


# --- 2. MENSAGENS FIXADAS EM CONVERSAS DIRETAS (DMs) ---

@router.get("/dms/conversations/{conversation_id}/pins", response_model=List[MessageResponse])
@router.get("/dms/{conversation_id}/pins", response_model=List[MessageResponse])
def list_dm_pinned_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(DMConversation).filter(DMConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    ensure_dm_participant(conv, current_user.id)

    pinned = db.query(DMMessage).filter(
        DMMessage.conversation_id == conversation_id,
        DMMessage.is_pinned == True
    ).order_by(DMMessage.id.desc()).all()

    return [format_dm_message(m) for m in pinned]


@router.patch("/dms/conversations/{conversation_id}/messages/{message_id}/pin", response_model=MessageResponse)
@router.patch("/dms/{conversation_id}/messages/{message_id}/pin", response_model=MessageResponse)
async def toggle_pin_dm_message(
    conversation_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conv = db.query(DMConversation).filter(DMConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    ensure_dm_participant(conv, current_user.id)

    message = db.query(DMMessage).filter(
        DMMessage.id == message_id,
        DMMessage.conversation_id == conversation_id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Mensagem direta não encontrada")

    if not message.is_pinned:
        current_pins_count = db.query(DMMessage).filter(
            DMMessage.conversation_id == conversation_id,
            DMMessage.is_pinned == True
        ).count()
        if current_pins_count >= MAX_PINS_PER_CHANNEL:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Limite de {MAX_PINS_PER_CHANNEL} mensagens fixadas na conversa atingido."
            )
        message.is_pinned = True
    else:
        message.is_pinned = False

    db.commit()
    db.refresh(message)

    resp = format_dm_message(message)

    # Broadcast via WebSocket para sincronizar os participantes da DM
    await socket_manager.broadcast_to_dm(
        conversation_id,
        {
            "type": "message_pin",
            "event": "message:pin",
            "message_id": message.id,
            "is_pinned": message.is_pinned,
            "data": resp.model_dump(mode="json"),
            "message": resp.model_dump(mode="json"),
        }
    )

    action = "fixada" if message.is_pinned else "desafixada"
    logger.info(f"Mensagem de DM {message_id} foi {action} na conversa {conversation_id} pelo usuário {current_user.id}")

    return resp

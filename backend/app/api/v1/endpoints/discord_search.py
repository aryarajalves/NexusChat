from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.core.logger import logger
from app.models.user import User
from app.models.discord import Server, Channel, ServerMember, Message, MessageReaction, DMConversation, DMMessage
from app.schemas.discord import (
    MessageResponse,
    MessageSearchResponse,
    ReactionSummary
)
from app.api.v1.endpoints.users import get_current_user

router = APIRouter(prefix="/discord", tags=["Discord Search"])


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


def format_bulk_reactions(message_ids: List[int], current_user_id: int, db: Session):
    if not message_ids:
        return {}
    all_reactions = db.query(MessageReaction).filter(MessageReaction.message_id.in_(message_ids)).all()
    res = {mid: {} for mid in message_ids}
    for r in all_reactions:
        mid_map = res.get(r.message_id)
        if mid_map is None:
            continue
        if r.emoji not in mid_map:
            mid_map[r.emoji] = {"count": 0, "user_ids": [], "reacted_by_me": False}
        mid_map[r.emoji]["count"] += 1
        mid_map[r.emoji]["user_ids"].append(r.user_id)
        if r.user_id == current_user_id:
            mid_map[r.emoji]["reacted_by_me"] = True

    final_map = {}
    for mid, group in res.items():
        final_map[mid] = [
            ReactionSummary(
                emoji=emoji,
                count=data["count"],
                user_ids=data["user_ids"],
                reacted_by_me=data["reacted_by_me"]
            )
            for emoji, data in group.items()
        ]
    return final_map


def build_search_message_response(msg: Message, reactions: Optional[List[ReactionSummary]] = None) -> MessageResponse:
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
        reactions=reactions or [],
        created_at=ensure_utc(msg.created_at),
        updated_at=ensure_utc(msg.updated_at)
    )


def build_search_dm_response(msg: DMMessage) -> MessageResponse:
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
        reactions=[],
        created_at=ensure_utc(msg.created_at),
        updated_at=ensure_utc(msg.updated_at)
    )


@router.get("/channels/{channel_id}/search", response_model=MessageSearchResponse)
def search_channel_messages(
    channel_id: int,
    q: Optional[str] = Query(None, description="Termo de busca textual"),
    author_id: Optional[int] = Query(None, description="Filtrar por ID do autor"),
    has_attachment: Optional[bool] = Query(None, description="Filtrar por presença de anexo"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal não encontrado")

    ensure_server_member(channel.server_id, current_user.id, db)

    query = db.query(Message).filter(Message.channel_id == channel_id)

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        query = query.filter(Message.content.ilike(search_pattern))

    if author_id is not None:
        query = query.filter(Message.author_id == author_id)

    if has_attachment is True:
        query = query.filter(Message.attachment_url.isnot(None), Message.attachment_url != "")
    elif has_attachment is False:
        query = query.filter(or_(Message.attachment_url.is_(None), Message.attachment_url == ""))

    total = query.count()
    messages = query.order_by(Message.id.desc()).offset(offset).limit(limit).all()

    reaction_map = format_bulk_reactions([m.id for m in messages], current_user.id, db)
    formatted = [build_search_message_response(m, reaction_map.get(m.id, [])) for m in messages]

    logger.info(f"Busca no canal {channel_id}: '{q}' retornou {total} mensagens para o usuário {current_user.id}")

    return MessageSearchResponse(
        total=total,
        channel_id=channel_id,
        query=q,
        messages=formatted
    )


@router.get("/servers/{server_id}/search", response_model=MessageSearchResponse)
def search_server_messages(
    server_id: int,
    q: Optional[str] = Query(None, description="Termo de busca textual"),
    channel_id: Optional[int] = Query(None, description="Filtrar por canal específico do servidor"),
    author_id: Optional[int] = Query(None, description="Filtrar por autor"),
    has_attachment: Optional[bool] = Query(None, description="Filtrar por presença de anexo"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_server_member(server_id, current_user.id, db)

    # Obter os canais do servidor
    channels_query = db.query(Channel.id).filter(Channel.server_id == server_id)
    if channel_id is not None:
        channels_query = channels_query.filter(Channel.id == channel_id)

    channel_ids = [c[0] for c in channels_query.all()]
    if not channel_ids:
        return MessageSearchResponse(total=0, server_id=server_id, query=q, messages=[])

    query = db.query(Message).filter(Message.channel_id.in_(channel_ids))

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        query = query.filter(Message.content.ilike(search_pattern))

    if author_id is not None:
        query = query.filter(Message.author_id == author_id)

    if has_attachment is True:
        query = query.filter(Message.attachment_url.isnot(None), Message.attachment_url != "")
    elif has_attachment is False:
        query = query.filter(or_(Message.attachment_url.is_(None), Message.attachment_url == ""))

    total = query.count()
    messages = query.order_by(Message.id.desc()).offset(offset).limit(limit).all()

    reaction_map = format_bulk_reactions([m.id for m in messages], current_user.id, db)
    formatted = [build_search_message_response(m, reaction_map.get(m.id, [])) for m in messages]

    return MessageSearchResponse(
        total=total,
        server_id=server_id,
        channel_id=channel_id,
        query=q,
        messages=formatted
    )


@router.get("/dms/{conversation_id}/search", response_model=MessageSearchResponse)
@router.get("/dms/conversations/{conversation_id}/search", response_model=MessageSearchResponse)
def search_dm_messages(
    conversation_id: int,
    q: Optional[str] = Query(None, description="Termo de busca textual"),
    has_attachment: Optional[bool] = Query(None, description="Filtrar por presença de anexo"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    conversation = db.query(DMConversation).filter(DMConversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    if current_user.id not in (conversation.user1_id, conversation.user2_id):
        raise HTTPException(status_code=403, detail="Acesso negado a esta conversa privada")

    query = db.query(DMMessage).filter(DMMessage.conversation_id == conversation_id)

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        query = query.filter(DMMessage.content.ilike(search_pattern))

    if has_attachment is True:
        query = query.filter(DMMessage.attachment_url.isnot(None), DMMessage.attachment_url != "")
    elif has_attachment is False:
        query = query.filter(or_(DMMessage.attachment_url.is_(None), DMMessage.attachment_url == ""))

    total = query.count()
    messages = query.order_by(DMMessage.id.desc()).offset(offset).limit(limit).all()

    formatted = [build_search_dm_response(m) for m in messages]

    logger.info(f"Busca na DM {conversation_id}: '{q}' retornou {total} mensagens para o usuário {current_user.id}")

    return MessageSearchResponse(
        total=total,
        conversation_id=conversation_id,
        query=q,
        messages=formatted
    )

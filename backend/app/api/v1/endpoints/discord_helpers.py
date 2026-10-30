from datetime import datetime, timezone
from typing import List, Optional, Dict
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.discord import Message, MessageReaction
from app.schemas.discord import MessageResponse, ReactionSummary

def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Garante que um objeto datetime possua timezone UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def format_message_reactions(message_id: int, current_user_id: int, db: Session) -> List[ReactionSummary]:
    """Agrupa e formata as reações de uma mensagem individual."""
    reactions = db.query(MessageReaction).filter(MessageReaction.message_id == message_id).all()
    groups: Dict[str, dict] = {}
    for r in reactions:
        if r.emoji not in groups:
            groups[r.emoji] = {"count": 0, "user_ids": [], "reacted_by_me": False}
        groups[r.emoji]["count"] += 1
        groups[r.emoji]["user_ids"].append(r.user_id)
        if r.user_id == current_user_id:
            groups[r.emoji]["reacted_by_me"] = True

    return [
        ReactionSummary(
            emoji=emoji,
            count=data["count"],
            user_ids=data["user_ids"],
            reacted_by_me=data["reacted_by_me"]
        )
        for emoji, data in groups.items()
    ]

def format_bulk_message_reactions(message_ids: List[int], current_user_id: int, db: Session) -> Dict[int, List[ReactionSummary]]:
    """Carrega e agrupa reações em lote para evitar queries N+1 no feed de mensagens."""
    if not message_ids:
        return {}
    all_reactions = db.query(MessageReaction).filter(MessageReaction.message_id.in_(message_ids)).all()
    res: Dict[int, dict] = {mid: {} for mid in message_ids}
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

def build_message_response(
    msg: Message,
    reactions: Optional[List[ReactionSummary]] = None,
    author: Optional[User] = None
) -> MessageResponse:
    """Monta o schema Pydantic MessageResponse a partir do modelo SQLAlchemy Message."""
    author_name = author.name if author else (msg.author.name if msg.author else "Usuário")
    author_email = author.email if author else (msg.author.email if msg.author else "")
    author_avatar_url = author.avatar_url if author else (msg.author.avatar_url if msg.author else None)
    return MessageResponse(
        id=msg.id,
        channel_id=msg.channel_id,
        author_id=msg.author_id,
        author_name=author_name,
        author_email=author_email,
        author_avatar_url=author_avatar_url,
        content=msg.content,
        attachment_url=msg.attachment_url,
        attachment_type=msg.attachment_type,
        attachment_size=msg.attachment_size,
        reply_to_id=msg.reply_to_id,
        is_edited=msg.is_edited,
        is_pinned=bool(getattr(msg, "is_pinned", False)),
        reactions=reactions or [],
        created_at=ensure_utc(msg.created_at),
        updated_at=ensure_utc(msg.updated_at)
    )

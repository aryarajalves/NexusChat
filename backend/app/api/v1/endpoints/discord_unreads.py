from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.v1.endpoints.users import get_current_user
from app.models.user import User
from app.models.discord import (
    ServerMember,
    Channel,
    Message,
    ChannelReadState,
    DMConversation,
    DMMessage,
    DMReadState,
)

router = APIRouter(prefix="/discord", tags=["discord-unreads"])


def utc_now():
    return datetime.now(timezone.utc)


@router.get("/unreads")
def get_user_unreads(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Retorna o total de mensagens não lidas agrupadas por canais, servidores e conversas diretas (DMs).
    """
    # 1. Busca todos os servidores dos quais o usuário participa
    memberships = (
        db.query(ServerMember)
        .filter(ServerMember.user_id == current_user.id)
        .all()
    )
    server_ids = [m.server_id for m in memberships]

    channels_unreads: Dict[str, int] = {}
    servers_unreads: Dict[str, int] = {str(sid): 0 for sid in server_ids}

    if server_ids:
        # Busca canais de texto desses servidores
        text_channels = (
            db.query(Channel)
            .filter(Channel.server_id.in_(server_ids), Channel.type == "TEXT")
            .all()
        )
        channel_ids = [ch.id for ch in text_channels]
        channels_unreads = {str(ch.id): 0 for ch in text_channels}

        if channel_ids:
            # Query agregada única de alta escala (elimina N+1 queries)
            unread_rows = (
                db.query(
                    Message.channel_id,
                    func.count(Message.id).label("unread_count")
                )
                .outerjoin(
                    ChannelReadState,
                    (ChannelReadState.channel_id == Message.channel_id)
                    & (ChannelReadState.user_id == current_user.id)
                )
                .filter(
                    Message.channel_id.in_(channel_ids),
                    Message.author_id != current_user.id,
                    Message.id > func.coalesce(ChannelReadState.last_read_message_id, 0)
                )
                .group_by(Message.channel_id)
                .all()
            )
            for ch_id, count in unread_rows:
                channels_unreads[str(ch_id)] = count

            for ch in text_channels:
                cnt = channels_unreads.get(str(ch.id), 0)
                servers_unreads[str(ch.server_id)] = servers_unreads.get(str(ch.server_id), 0) + cnt

    # 2. Busca todas as conversas diretas (DMs) do usuário
    dm_conversations = (
        db.query(DMConversation)
        .filter(
            (DMConversation.user1_id == current_user.id)
            | (DMConversation.user2_id == current_user.id)
        )
        .all()
    )
    dm_ids = [conv.id for conv in dm_conversations]

    dms_unreads: Dict[str, int] = {}
    total_dms = 0

    if dm_ids:
        dms_unreads = {str(conv.id): 0 for conv in dm_conversations}
        # Query agregada única de alta escala para conversas diretas
        dm_unread_rows = (
            db.query(
                DMMessage.conversation_id,
                func.count(DMMessage.id).label("unread_count")
            )
            .outerjoin(
                DMReadState,
                (DMReadState.conversation_id == DMMessage.conversation_id)
                & (DMReadState.user_id == current_user.id)
            )
            .filter(
                DMMessage.conversation_id.in_(dm_ids),
                DMMessage.author_id != current_user.id,
                DMMessage.id > func.coalesce(DMReadState.last_read_message_id, 0)
            )
            .group_by(DMMessage.conversation_id)
            .all()
        )
        for conv_id, count in dm_unread_rows:
            dms_unreads[str(conv_id)] = count
            total_dms += count

    return {
        "channels": channels_unreads,
        "servers": servers_unreads,
        "dms": dms_unreads,
        "total_dms": total_dms,
    }


@router.post("/channels/{channel_id}/ack")
def mark_channel_as_read(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Marca todas as mensagens do canal como lidas para o usuário atual (atualiza last_read_message_id).
    """
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Canal não encontrado.",
        )

    # Verifica se usuário participa do servidor
    membership = (
        db.query(ServerMember)
        .filter(
            ServerMember.server_id == channel.server_id,
            ServerMember.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não é membro deste servidor.",
        )

    max_message_id = (
        db.query(func.max(Message.id))
        .filter(Message.channel_id == channel_id)
        .scalar()
    ) or 0

    state = (
        db.query(ChannelReadState)
        .filter(
            ChannelReadState.user_id == current_user.id,
            ChannelReadState.channel_id == channel_id,
        )
        .first()
    )

    if not state:
        state = ChannelReadState(
            user_id=current_user.id,
            channel_id=channel_id,
            last_read_message_id=max_message_id,
            updated_at=utc_now(),
        )
        db.add(state)
    else:
        state.last_read_message_id = max_message_id
        state.updated_at = utc_now()

    db.commit()

    return {
        "status": "ok",
        "channel_id": channel_id,
        "last_read_message_id": max_message_id,
        "unread": 0,
    }


@router.post("/dms/conversations/{conversation_id}/ack")
def mark_dm_as_read(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Marca todas as mensagens da DM como lidas para o usuário atual (atualiza last_read_message_id).
    """
    conversation = (
        db.query(DMConversation)
        .filter(DMConversation.id == conversation_id)
        .first()
    )
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversa não encontrada.",
        )

    if (
        conversation.user1_id != current_user.id
        and conversation.user2_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não participa desta conversa.",
        )

    max_message_id = (
        db.query(func.max(DMMessage.id))
        .filter(DMMessage.conversation_id == conversation_id)
        .scalar()
    ) or 0

    state = (
        db.query(DMReadState)
        .filter(
            DMReadState.user_id == current_user.id,
            DMReadState.conversation_id == conversation_id,
        )
        .first()
    )

    if not state:
        state = DMReadState(
            user_id=current_user.id,
            conversation_id=conversation_id,
            last_read_message_id=max_message_id,
            updated_at=utc_now(),
        )
        db.add(state)
    else:
        state.last_read_message_id = max_message_id
        state.updated_at = utc_now()

    db.commit()

    return {
        "status": "ok",
        "conversation_id": conversation_id,
        "last_read_message_id": max_message_id,
        "unread": 0,
    }

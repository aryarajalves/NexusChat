"""
Endpoints REST e gerenciamento de Tópicos (Threads) em mensagens de canal.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.logger import logger
from app.core.rate_limiter import check_rate_limit
from app.models.user import User
from app.models.discord import Channel, Message, MessageThread, ThreadMessage
from app.schemas.discord import (
    ThreadCreate,
    ThreadDetailResponse,
    ThreadSummary,
    ThreadMessageCreate,
    ThreadMessageResponse,
)
from app.api.v1.endpoints.users import get_current_user
from app.api.v1.endpoints.discord_helpers import (
    ensure_utc,
    build_message_response,
    build_thread_summary,
    format_message_reactions,
)
from app.services.discord_permissions import ensure_channel_access
from app.services.socket_manager import socket_manager

router = APIRouter(prefix="/discord", tags=["Discord Threads"])


def _format_thread_message(tm: ThreadMessage) -> ThreadMessageResponse:
    author = tm.author
    return ThreadMessageResponse(
        id=tm.id,
        thread_id=tm.thread_id,
        author_id=tm.author_id,
        author_name=author.name if author else "Usuário",
        author_email=author.email if author else "",
        author_avatar_url=author.avatar_url if author else None,
        content=tm.content,
        attachment_url=tm.attachment_url,
        attachment_type=tm.attachment_type,
        attachment_size=tm.attachment_size,
        created_at=ensure_utc(tm.created_at),
        updated_at=ensure_utc(tm.updated_at),
    )


@router.post(
    "/channels/{channel_id}/messages/{message_id}/threads",
    response_model=ThreadDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_or_get_message_thread(
    channel_id: int,
    message_id: int,
    payload: ThreadCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cria ou recupera o tópico associado a uma mensagem raiz do canal.
    Se já existir um tópico para a mensagem, retorna o tópico existente.
    """
    channel = ensure_channel_access(channel_id, current_user, db)
    if channel.type != "TEXT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tópicos só podem ser criados em canais de texto.",
        )

    root_message = (
        db.query(Message)
        .filter(Message.id == message_id, Message.channel_id == channel_id)
        .first()
    )
    if not root_message:
        raise HTTPException(status_code=404, detail="Mensagem raiz não encontrada.")

    thread = (
        db.query(MessageThread)
        .options(
            joinedload(MessageThread.creator),
            joinedload(MessageThread.messages).joinedload(ThreadMessage.author),
        )
        .filter(MessageThread.root_message_id == message_id)
        .first()
    )

    clean_name = (payload.name or "").strip()
    if not clean_name:
        clean_name = root_message.content[:40].strip() if root_message.content else ""
        if not clean_name:
            clean_name = "Tópico da Mensagem"

    if not thread:
        thread = MessageThread(
            channel_id=channel_id,
            root_message_id=message_id,
            creator_id=current_user.id,
            name=clean_name[:100],
        )
        db.add(thread)
        db.commit()
        db.refresh(thread)

        thread = (
            db.query(MessageThread)
            .options(
                joinedload(MessageThread.creator),
                joinedload(MessageThread.messages).joinedload(ThreadMessage.author),
            )
            .filter(MessageThread.id == thread.id)
            .first()
        )

        summary = build_thread_summary(thread)
        await socket_manager.broadcast_to_channel(
            channel_id,
            {
                "event": "thread:created",
                "channel_id": channel_id,
                "message_id": message_id,
                "thread": summary.model_dump(mode="json") if summary else None,
            },
        )
        logger.info(
            f"Tópico '{thread.name}' criado pelo usuário {current_user.email} na mensagem ID {message_id}."
        )

    root_reactions = format_message_reactions(root_message.id, current_user.id, db)
    root_resp = build_message_response(root_message, root_reactions, thread_summary=build_thread_summary(thread))

    return ThreadDetailResponse(
        id=thread.id,
        channel_id=thread.channel_id,
        root_message_id=thread.root_message_id,
        creator_id=thread.creator_id,
        creator_name=thread.creator.name if thread.creator else "Usuário",
        name=thread.name,
        root_message=root_resp,
        messages=[_format_thread_message(m) for m in thread.messages],
        created_at=ensure_utc(thread.created_at),
        updated_at=ensure_utc(thread.updated_at),
    )


@router.get(
    "/threads/{thread_id}",
    response_model=ThreadDetailResponse,
)
def get_thread_details(
    thread_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna os detalhes de um tópico com a mensagem raiz e todas as respostas."""
    thread = (
        db.query(MessageThread)
        .options(
            joinedload(MessageThread.creator),
            joinedload(MessageThread.messages).joinedload(ThreadMessage.author),
            joinedload(MessageThread.root_message).joinedload(Message.author),
        )
        .filter(MessageThread.id == thread_id)
        .first()
    )
    if not thread:
        raise HTTPException(status_code=404, detail="Tópico não encontrado.")

    ensure_channel_access(thread.channel_id, current_user, db)

    root_resp = None
    if thread.root_message:
        root_reactions = format_message_reactions(thread.root_message.id, current_user.id, db)
        root_resp = build_message_response(thread.root_message, root_reactions, thread_summary=build_thread_summary(thread))

    return ThreadDetailResponse(
        id=thread.id,
        channel_id=thread.channel_id,
        root_message_id=thread.root_message_id,
        creator_id=thread.creator_id,
        creator_name=thread.creator.name if thread.creator else "Usuário",
        name=thread.name,
        root_message=root_resp,
        messages=[_format_thread_message(m) for m in thread.messages],
        created_at=ensure_utc(thread.created_at),
        updated_at=ensure_utc(thread.updated_at),
    )


@router.post(
    "/threads/{thread_id}/messages",
    response_model=ThreadMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_thread_message(
    thread_id: int,
    payload: ThreadMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Envia uma mensagem dentro do tópico e propaga em tempo real via WebSocket."""
    await check_rate_limit(
        f"thread_msg:user:{current_user.id}",
        max_requests=5,
        window_seconds=3,
        error_detail="Você está enviando mensagens rápido demais. Aguarde 3 segundos.",
    )

    thread = db.query(MessageThread).filter(MessageThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Tópico não encontrado.")

    ensure_channel_access(thread.channel_id, current_user, db)

    content = (payload.content or "").strip()
    if not content and not payload.attachment_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A mensagem do tópico precisa conter texto ou anexo.",
        )

    t_msg = ThreadMessage(
        thread_id=thread.id,
        author_id=current_user.id,
        content=content,
        attachment_url=payload.attachment_url,
        attachment_type=payload.attachment_type,
        attachment_size=payload.attachment_size,
    )
    db.add(t_msg)
    db.commit()
    db.refresh(t_msg)

    # Recarrega a thread atualizada para gerar o resumo do badge
    refreshed_thread = (
        db.query(MessageThread)
        .options(
            joinedload(MessageThread.creator),
            joinedload(MessageThread.messages).joinedload(ThreadMessage.author),
        )
        .filter(MessageThread.id == thread.id)
        .first()
    )
    summary = build_thread_summary(refreshed_thread)
    resp = _format_thread_message(t_msg)

    # Broadcast via WebSocket para sincronizar o feed do tópico e o badge da mensagem raiz
    await socket_manager.broadcast_to_channel(
        thread.channel_id,
        {
            "event": "thread:message:new",
            "channel_id": thread.channel_id,
            "thread_id": thread.id,
            "root_message_id": thread.root_message_id,
            "message": resp.model_dump(mode="json"),
            "thread_summary": summary.model_dump(mode="json") if summary else None,
        },
    )

    return resp

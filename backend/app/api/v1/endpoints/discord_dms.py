import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect, File, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db, SessionLocal
from app.core.security import decode_access_token
from app.core.logger import logger
from app.models.user import User
from app.models.discord import DMConversation, DMMessage, DMMessageReaction, utc_now
from app.schemas.discord import (
    DMConversationCreate,
    DMConversationResponse,
    DMUserSummary,
    MessageCreate,
    MessageUpdate,
    MessageResponse,
    ReactionCreate,
    ReactionSummary,
)
from app.api.v1.endpoints.users import get_current_user
from app.services.socket_manager import socket_manager, notify_dm_unread
from app.services.storage import upload_discord_media_file, DISCORD_UPLOAD_DIR
from app.core.rate_limiter import check_rate_limit
from app.core.upload_security import validate_uploaded_file

router = APIRouter(prefix="/discord/dms", tags=["discord-dms"])

UPLOAD_DIR = DISCORD_UPLOAD_DIR
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB



def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def ensure_conversation_participant(conversation: DMConversation, user_id: int):
    """Garante que o usuário faz parte da conversa privada."""
    if user_id not in (conversation.user1_id, conversation.user2_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado a esta conversa privada."
        )


def format_dm_message(msg: DMMessage) -> MessageResponse:
    """Serializa uma mensagem de DM no formato padronizado MessageResponse."""
    reaction_counts = {}
    reaction_users = {}
    for r in msg.reactions:
        reaction_counts[r.emoji] = reaction_counts.get(r.emoji, 0) + 1
        if r.emoji not in reaction_users:
            reaction_users[r.emoji] = []
        reaction_users[r.emoji].append(r.user_id)

    reactions_list = [
        ReactionSummary(emoji=emoji, count=count, user_ids=reaction_users[emoji])
        for emoji, count in reaction_counts.items()
    ]

    return MessageResponse(
        id=msg.id,
        channel_id=msg.conversation_id,  # Usa o conversation_id como identificador de sala
        author_id=msg.author_id,
        author_name=msg.author.name if msg.author else "Usuário",
        author_email=msg.author.email if msg.author else "",
        content=msg.content,
        attachment_url=msg.attachment_url,
        attachment_type=msg.attachment_type,
        attachment_size=msg.attachment_size,
        reply_to_id=msg.reply_to_id,
        is_edited=msg.is_edited,
        is_pinned=bool(getattr(msg, "is_pinned", False)),
        reactions=reactions_list,
        created_at=ensure_utc(msg.created_at),
        updated_at=ensure_utc(msg.updated_at)
    )


@router.get("/users", response_model=List[DMUserSummary])
def list_available_users_for_dm(
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista usuários registrados no sistema disponíveis para iniciar conversa privada."""
    query = db.query(User).filter(User.id != current_user.id, User.is_active == True)
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(User.name.ilike(term), User.email.ilike(term)))
    
    users = query.order_by(User.name.asc()).limit(50).all()
    return [
        DMUserSummary(
            id=u.id,
            name=u.name,
            email=u.email,
            is_active=u.is_active
        )
        for u in users
    ]


@router.get("/conversations", response_model=List[DMConversationResponse])
def list_dm_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista todas as conversas diretas do usuário logado, com último histórico."""
    conversations = db.query(DMConversation).filter(
        or_(
            DMConversation.user1_id == current_user.id,
            DMConversation.user2_id == current_user.id
        )
    ).order_by(DMConversation.updated_at.desc()).all()

    result = []
    for conv in conversations:
        other_user = conv.user2 if conv.user1_id == current_user.id else conv.user1
        last_msg = (
            db.query(DMMessage)
            .filter(DMMessage.conversation_id == conv.id)
            .order_by(DMMessage.id.desc())
            .first()
        )
        last_msg_response = format_dm_message(last_msg) if last_msg else None

        result.append(
            DMConversationResponse(
                id=conv.id,
                other_user=DMUserSummary(
                    id=other_user.id,
                    name=other_user.name,
                    email=other_user.email,
                    is_active=other_user.is_active
                ),
                last_message=last_msg_response,
                created_at=conv.created_at,
                updated_at=conv.updated_at
            )
        )
    return result


@router.post("/conversations", response_model=DMConversationResponse, status_code=status.HTTP_201_CREATED)
def get_or_create_dm_conversation(
    payload: DMConversationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Abre ou cria uma conversa privada com o usuário de destino."""
    if payload.target_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível iniciar uma mensagem direta consigo mesmo."
        )

    target = db.query(User).filter(User.id == payload.target_user_id, User.is_active == True).first()
    if not target:
        raise HTTPException(status_code=404, detail="Usuário destinatário não encontrado.")

    u1 = min(current_user.id, target.id)
    u2 = max(current_user.id, target.id)

    conv = db.query(DMConversation).filter(
        DMConversation.user1_id == u1,
        DMConversation.user2_id == u2
    ).first()

    if not conv:
        conv = DMConversation(user1_id=u1, user2_id=u2)
        db.add(conv)
        db.commit()
        db.refresh(conv)

    other_user = conv.user2 if conv.user1_id == current_user.id else conv.user1
    last_msg = (
        db.query(DMMessage)
        .filter(DMMessage.conversation_id == conv.id)
        .order_by(DMMessage.id.desc())
        .first()
    )

    return DMConversationResponse(
        id=conv.id,
        other_user=DMUserSummary(
            id=other_user.id,
            name=other_user.name,
            email=other_user.email,
            is_active=other_user.is_active
        ),
        last_message=format_dm_message(last_msg) if last_msg else None,
        created_at=conv.created_at,
        updated_at=conv.updated_at
    )


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
def get_dm_messages(
    conversation_id: int,
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtém o histórico de mensagens de uma conversa privada."""
    conv = db.query(DMConversation).filter(DMConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")
    ensure_conversation_participant(conv, current_user.id)

    messages = (
        db.query(DMMessage)
        .filter(DMMessage.conversation_id == conversation_id)
        .order_by(DMMessage.id.desc())
        .limit(limit)
        .all()
    )
    return [format_dm_message(m) for m in reversed(messages)]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_dm_message(
    conversation_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Envia uma mensagem privada para a conversa."""
    await check_rate_limit(
        f"msg:user:{current_user.id}",
        max_requests=5,
        window_seconds=3,
        error_detail="Você está enviando mensagens rápido demais. Aguarde 3 segundos."
    )
    conv = db.query(DMConversation).filter(DMConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")
    ensure_conversation_participant(conv, current_user.id)

    if not payload.content and not payload.attachment_url:
        raise HTTPException(status_code=400, detail="A mensagem deve conter texto ou anexo.")

    msg = DMMessage(
        conversation_id=conversation_id,
        author_id=current_user.id,
        content=payload.content or "",
        attachment_url=payload.attachment_url,
        attachment_type=payload.attachment_type,
        attachment_size=payload.attachment_size,
        reply_to_id=payload.reply_to_id
    )
    db.add(msg)
    conv.updated_at = utc_now()
    db.commit()
    db.refresh(msg)

    response_data = format_dm_message(msg)

    # Dispara evento em tempo real via WebSocket
    await socket_manager.broadcast_to_dm(conversation_id, {
        "type": "new_message",
        "data": response_data.model_dump(mode="json")
    })

    # Notifica o outro usuário sobre a nova mensagem privada não lida
    other_user_id = conv.user2_id if conv.user1_id == current_user.id else conv.user1_id
    await notify_dm_unread(conversation_id, msg.id, other_user_id)

    return response_data


@router.post("/conversations/{conversation_id}/attachments")
async def upload_dm_attachment(
    conversation_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Faz upload de arquivo, áudio ou imagem para envio na DM (limite de 50 MB e sanitizado)."""
    await check_rate_limit(
        f"upload:user:{current_user.id}",
        max_requests=10,
        window_seconds=60,
        error_detail="Limite de uploads excedido. Aguarde 1 minuto."
    )
    conv = db.query(DMConversation).filter(DMConversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")
    ensure_conversation_participant(conv, current_user.id)

    file_bytes = await file.read()
    val_res = validate_uploaded_file(file.filename or "", file_bytes, max_size_bytes=MAX_FILE_SIZE_BYTES)

    unique_name = f"{uuid.uuid4().hex}{val_res['extension']}"
    upload_res = upload_discord_media_file(file_bytes, unique_name, file.content_type)

    return {
        "attachment_url": upload_res["attachment_url"],
        "attachment_type": file.content_type or "application/octet-stream",
        "attachment_size": len(file_bytes),
        "filename": val_res["clean_filename"]
    }



@router.patch("/messages/{message_id}", response_model=MessageResponse)
async def edit_dm_message(
    message_id: int,
    payload: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Edita uma mensagem enviada na DM (apenas o próprio autor)."""
    msg = db.query(DMMessage).filter(DMMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada.")

    if msg.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Você só pode editar suas próprias mensagens.")

    msg.content = payload.content.strip()
    msg.is_edited = True
    msg.updated_at = utc_now()
    db.commit()
    db.refresh(msg)

    response_data = format_dm_message(msg)
    await socket_manager.broadcast_to_dm(msg.conversation_id, {
        "type": "message_edited",
        "data": response_data.model_dump(mode="json")
    })
    return response_data


@router.delete("/messages/{message_id}", status_code=status.HTTP_200_OK)
async def delete_dm_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exclui uma mensagem enviada na DM (apenas o próprio autor)."""
    msg = db.query(DMMessage).filter(DMMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada.")

    if msg.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Você só pode excluir suas próprias mensagens.")

    conv_id = msg.conversation_id
    db.delete(msg)
    db.commit()

    await socket_manager.broadcast_to_dm(conv_id, {
        "type": "message_deleted",
        "data": {"message_id": message_id, "conversation_id": conv_id}
    })
    return {"message": "Mensagem excluída com sucesso."}


@router.post("/messages/{message_id}/reactions", status_code=status.HTTP_200_OK)
async def toggle_dm_message_reaction(
    message_id: int,
    payload: ReactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Alterna reação com emoji na mensagem da DM."""
    msg = db.query(DMMessage).filter(DMMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada.")

    conv = db.query(DMConversation).filter(DMConversation.id == msg.conversation_id).first()
    ensure_conversation_participant(conv, current_user.id)

    emoji = payload.emoji.strip()
    existing = db.query(DMMessageReaction).filter(
        DMMessageReaction.message_id == message_id,
        DMMessageReaction.user_id == current_user.id,
        DMMessageReaction.emoji == emoji
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        action = "removed"
    else:
        new_reaction = DMMessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            emoji=emoji
        )
        db.add(new_reaction)
        db.commit()
        action = "added"

    db.refresh(msg)
    response_data = format_dm_message(msg)

    await socket_manager.broadcast_to_dm(msg.conversation_id, {
        "type": "reaction_updated",
        "data": {
            "message_id": message_id,
            "reactions": [r.model_dump() for r in response_data.reactions]
        }
    })

    return {
        "action": action,
        "emoji": emoji,
        "reactions": response_data.reactions
    }


@router.websocket("/ws/{conversation_id}")
async def dm_websocket_endpoint(
    websocket: WebSocket,
    conversation_id: int,
    token: str = Query(...)
):
    """Endpoint WebSocket para troca de mensagens e digitação em tempo real na DM."""
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    email = payload.get("sub")
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email, User.is_active == True).first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        conv = db.query(DMConversation).filter(DMConversation.id == conversation_id).first()
        if not conv or user.id not in (conv.user1_id, conv.user2_id):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        user_id = user.id
        user_name = user.name
    finally:
        db.close()

    await socket_manager.connect_dm(conversation_id, user_id, user_name, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "typing":
                await socket_manager.broadcast_to_dm(
                    conversation_id,
                    {
                        "type": "user_typing",
                        "data": {
                            "user_id": user_id,
                            "user_name": user_name,
                            "is_typing": bool(data.get("is_typing", True))
                        }
                    },
                    exclude=websocket
                )
    except WebSocketDisconnect:
        socket_manager.disconnect_dm(conversation_id, websocket)
    except Exception as e:
        logger.error(f"[WebSocket DM Error] conv={conversation_id}: {e}")
        socket_manager.disconnect_dm(conversation_id, websocket)

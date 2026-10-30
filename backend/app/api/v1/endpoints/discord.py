import os
import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db, SessionLocal
from app.core.security import decode_access_token
from app.core.logger import logger
from app.models.user import User
from app.models.discord import Server, Channel, ServerMember, Message, ServerInvite, MessageReaction, ChannelRolePermission
from app.schemas.discord import (
    ServerCreate,
    ServerUpdate,
    ServerResponse,
    ChannelCreate,
    ChannelUpdate,
    ChannelResponse,
    MessageCreate,
    MessageUpdate,
    MessageForwardRequest,
    ReactionCreate,
    ReactionSummary,
    MessageResponse,
    ServerMemberResponse,
    ServerInviteCreate,
    ServerInviteResponse
)
from app.api.v1.endpoints.users import get_current_user
from app.services.socket_manager import socket_manager, notify_channel_unread
from app.services.storage import upload_discord_media_file, get_discord_media_file_path, DISCORD_UPLOAD_DIR
from app.core.rate_limiter import check_rate_limit
from app.core.upload_security import validate_uploaded_file, get_content_disposition_for_file
from .discord_helpers import (
    ensure_utc,
    format_message_reactions,
    format_bulk_message_reactions,
    build_message_response
)
from app.services.discord_permissions import (
    can_user_access_channel,
    ensure_channel_access,
    get_accessible_channel_recipients,
    build_channel_response
)

router = APIRouter(prefix="/discord", tags=["Discord Clone"])

# Configuração de upload de arquivos anexos (Backblaze B2 + Cache Local)
UPLOAD_DIR = DISCORD_UPLOAD_DIR
MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

def get_server_member(server_id: int, user_id: int, db: Session) -> Optional[ServerMember]:
    return db.query(ServerMember).filter(
        ServerMember.server_id == server_id,
        ServerMember.user_id == user_id
    ).first()

def ensure_member(server_id: int, user: User, db: Session) -> ServerMember:
    member = get_server_member(server_id, user.id, db)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não participa deste servidor"
        )
    return member

def ensure_admin_or_owner(server_id: int, user: User, db: Session) -> ServerMember:
    member = ensure_member(server_id, user, db)
    if member.role not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores ou o dono do servidor podem realizar esta ação"
        )
    return member

# ==========================================
# 1. SERVIDORES
# ==========================================

@router.post("/servers", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
def create_server(
    payload: ServerCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Valida limite de servidores do usuário
    if current_user.max_servers is not None and current_user.max_servers != -1:
        current_count = db.query(ServerMember).filter(ServerMember.user_id == current_user.id).count()
        if current_count >= current_user.max_servers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Limite máximo de {current_user.max_servers} servidores atingido para esta conta"
            )

    # Cria o servidor
    server = Server(
        name=payload.name.strip(),
        icon_url=payload.icon_url,
        description=payload.description,
        owner_id=current_user.id
    )
    db.add(server)
    db.flush()

    # Cria canais iniciais padrão (#geral de texto e Geral de voz)
    default_text = Channel(
        server_id=server.id,
        name="geral",
        type="TEXT",
        category="Canais de Texto",
        position=0
    )
    default_voice = Channel(
        server_id=server.id,
        name="geral",
        type="VOICE",
        category="Canais de Voz",
        position=1
    )
    db.add(default_text)
    db.add(default_voice)

    # Adiciona o criador como membro OWNER
    owner_member = ServerMember(
        server_id=server.id,
        user_id=current_user.id,
        role="OWNER"
    )
    db.add(owner_member)
    db.commit()
    db.refresh(server)

    res = ServerResponse.model_validate(server)
    res.members_count = 1
    return res

@router.get("/servers", response_model=List[ServerResponse])
def list_user_servers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    memberships = db.query(ServerMember).filter(ServerMember.user_id == current_user.id).all()
    servers = []
    for m in memberships:
        srv = m.server
        if srv:
            res = ServerResponse.model_validate(srv)
            res.members_count = len(srv.members)
            servers.append(res)
    return servers

@router.get("/servers/{server_id}", response_model=ServerResponse)
def get_server_details(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")
    ensure_member(server_id, current_user, db)

    res = ServerResponse.model_validate(server)
    res.members_count = len(server.members)
    return res

@router.patch("/servers/{server_id}", response_model=ServerResponse)
def update_server(
    server_id: int,
    payload: ServerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_admin_or_owner(server_id, current_user, db)
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")

    if payload.name is not None:
        server.name = payload.name.strip()
    if payload.icon_url is not None:
        server.icon_url = payload.icon_url
    if payload.banner_url is not None:
        server.banner_url = payload.banner_url
    if payload.description is not None:
        server.description = payload.description

    db.commit()
    db.refresh(server)

    res = ServerResponse.model_validate(server)
    res.members_count = len(server.members)
    return res

@router.delete("/servers/{server_id}")
def delete_server(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")

    if server.owner_id != current_user.id and current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas o criador do servidor ou superadmin pode excluí-lo"
        )

    server_name = server.name
    db.delete(server)
    db.commit()
    logger.info(f"Servidor '{server_name}' (ID {server_id}) excluído por '{current_user.email}'.")
    return {"detail": "Servidor excluído com sucesso"}

# ==========================================
# 2. CANAIS
# ==========================================

@router.post("/servers/{server_id}/channels", response_model=ChannelResponse, status_code=status.HTTP_201_CREATED)
def create_channel(
    server_id: int,
    payload: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_admin_or_owner(server_id, current_user, db)

    pos = payload.position
    if pos == 0:
        max_pos = db.query(Channel).filter(Channel.server_id == server_id).count()
        pos = max_pos

    channel = Channel(
        server_id=server_id,
        name=payload.name,
        type=payload.type,
        category=payload.category,
        position=pos,
        is_private=bool(payload.is_private)
    )
    db.add(channel)
    db.commit()
    db.refresh(channel)

    if payload.is_private and payload.allowed_role_ids:
        for r_id in payload.allowed_role_ids:
            perm = ChannelRolePermission(channel_id=channel.id, role_id=r_id)
            db.add(perm)
        db.commit()
        db.refresh(channel)

    return build_channel_response(channel)

@router.patch("/servers/{server_id}/channels/{channel_id}", response_model=ChannelResponse)
def update_channel(
    server_id: int,
    channel_id: int,
    payload: ChannelUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_admin_or_owner(server_id, current_user, db)
    channel = db.query(Channel).filter(
        Channel.id == channel_id,
        Channel.server_id == server_id
    ).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal não encontrado")

    if payload.name is not None:
        channel.name = payload.name
    if payload.category is not None:
        channel.category = payload.category
    if payload.position is not None:
        channel.position = payload.position
    if payload.is_private is not None:
        channel.is_private = payload.is_private

    if payload.allowed_role_ids is not None:
        db.query(ChannelRolePermission).filter(ChannelRolePermission.channel_id == channel.id).delete()
        if channel.is_private:
            for r_id in payload.allowed_role_ids:
                perm = ChannelRolePermission(channel_id=channel.id, role_id=r_id)
                db.add(perm)

    db.commit()
    db.refresh(channel)
    return build_channel_response(channel)

@router.get("/servers/{server_id}/channels", response_model=List[ChannelResponse])
def list_server_channels(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_member(server_id, current_user, db)
    channels = db.query(Channel).filter(Channel.server_id == server_id).order_by(Channel.position).all()
    accessible = [ch for ch in channels if can_user_access_channel(ch, current_user.id, db)]
    return [build_channel_response(ch) for ch in accessible]

@router.delete("/servers/{server_id}/channels/{channel_id}")
def delete_channel(
    server_id: int,
    channel_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_admin_or_owner(server_id, current_user, db)
    channel = db.query(Channel).filter(
        Channel.id == channel_id,
        Channel.server_id == server_id
    ).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal não encontrado")

    text_count = db.query(Channel).filter(
        Channel.server_id == server_id,
        Channel.type == "TEXT"
    ).count()
    if channel.type == "TEXT" and text_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O servidor precisa manter pelo menos 1 canal de texto ativo"
        )

    db.delete(channel)
    db.commit()
    return {"detail": "Canal excluído com sucesso"}

# ==========================================
# 3. MEMBROS & CONVITES
# ==========================================

@router.get("/servers/{server_id}/members", response_model=List[ServerMemberResponse])
def list_server_members(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_member(server_id, current_user, db)
    members = db.query(ServerMember).filter(ServerMember.server_id == server_id).all()
    
    result = []
    for m in members:
        role_name = m.custom_role.name if m.custom_role else None
        role_color = m.custom_role.color if m.custom_role else None
        result.append(ServerMemberResponse(
            id=m.id,
            server_id=m.server_id,
            user_id=m.user_id,
            name=m.user.name if m.user else "Usuário Desconhecido",
            email=m.user.email if m.user else "",
            avatar_url=m.user.avatar_url if m.user else None,
            nickname=m.nickname,
            role=m.role,
            role_id=m.role_id,
            role_name=role_name,
            role_color=role_color,
            joined_at=m.joined_at
        ))
    return result

@router.post("/servers/{server_id}/invites", response_model=ServerInviteResponse, status_code=status.HTTP_201_CREATED)
def create_server_invite(
    server_id: int,
    payload: Optional[ServerInviteCreate] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ensure_member(server_id, current_user, db)
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")

    if payload is None:
        payload = ServerInviteCreate()

    code = secrets.token_urlsafe(8)
    expires_at = None
    if payload.expires_in_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=payload.expires_in_hours)

    invite = ServerInvite(
        server_id=server_id,
        code=code,
        created_by_id=current_user.id,
        max_uses=payload.max_uses,
        expires_at=expires_at
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)

    return ServerInviteResponse(
        id=invite.id,
        server_id=server.id,
        server_name=server.name,
        code=invite.code,
        max_uses=invite.max_uses,
        current_uses=invite.current_uses,
        expires_at=invite.expires_at,
        created_at=invite.created_at
    )

@router.post("/invites/{code}/join", response_model=ServerResponse)
def join_server_by_invite(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    invite = db.query(ServerInvite).filter(ServerInvite.code == code).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Convite inválido ou inexistente")

    # Verifica expiração
    if invite.expires_at:
        exp = invite.expires_at if invite.expires_at.tzinfo else invite.expires_at.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Este link de convite expirou")

    # Verifica limite de usos
    if invite.max_uses is not None and invite.current_uses >= invite.max_uses:
        raise HTTPException(status_code=400, detail="Este convite atingiu o limite máximo de utilizações")

    # Verifica se já é membro
    existing_member = get_server_member(invite.server_id, current_user.id, db)
    if existing_member:
        server = db.query(Server).filter(Server.id == invite.server_id).first()
        res = ServerResponse.model_validate(server)
        res.members_count = len(server.members)
        return res

    # Valida limite de servidores do usuário
    if current_user.max_servers is not None and current_user.max_servers != -1:
        current_count = db.query(ServerMember).filter(ServerMember.user_id == current_user.id).count()
        if current_count >= current_user.max_servers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Você já atingiu o seu limite de {current_user.max_servers} servidores"
            )

    # Entra no servidor
    new_member = ServerMember(
        server_id=invite.server_id,
        user_id=current_user.id,
        role="MEMBER"
    )
    invite.current_uses += 1
    db.add(new_member)
    db.commit()

    server = db.query(Server).filter(Server.id == invite.server_id).first()
    res = ServerResponse.model_validate(server)
    res.members_count = len(server.members)
    return res

# ==========================================
# 4. MENSAGENS (REST API)
# ==========================================

@router.get("/channels/{channel_id}/messages", response_model=List[MessageResponse])
def list_channel_messages(
    channel_id: int,
    limit: int = Query(50, ge=1, le=100),
    before_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    channel = ensure_channel_access(channel_id, current_user, db)

    query = db.query(Message).filter(Message.channel_id == channel_id)
    if before_id:
        query = query.filter(Message.id < before_id)

    messages = query.order_by(Message.id.desc()).limit(limit).all()
    messages.reverse()

    reaction_map = format_bulk_message_reactions([m.id for m in messages], current_user.id, db)
    return [build_message_response(m, reaction_map.get(m.id, [])) for m in messages]

@router.post("/channels/{channel_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_channel_message(
    channel_id: int,
    payload: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    await check_rate_limit(
        f"msg:user:{current_user.id}",
        max_requests=5,
        window_seconds=3,
        error_detail="Você está enviando mensagens rápido demais. Aguarde 3 segundos."
    )
    channel = ensure_channel_access(channel_id, current_user, db)

    if channel.type != "TEXT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é possível enviar mensagens de texto em canais de voz"
        )

    content = (payload.content or "").strip()
    if not content and not payload.attachment_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A mensagem precisa conter texto ou anexo"
        )

    if len(content) > 2000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A mensagem excede o limite máximo permitido de 2.000 caracteres"
        )

    msg = Message(
        channel_id=channel_id,
        author_id=current_user.id,
        content=content,
        attachment_url=payload.attachment_url,
        attachment_type=payload.attachment_type,
        attachment_size=payload.attachment_size,
        reply_to_id=payload.reply_to_id
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    resp = build_message_response(msg, author=current_user)

    # Broadcast via WebSocket para sincronizar todos os clientes conectados
    await socket_manager.broadcast_to_channel(
        channel_id,
        {
            "event": "message:new",
            "message": resp.model_dump(mode="json")
        }
    )

    # Notifica os membros autorizados do canal sobre a nova mensagem não lida
    accessible_ids = get_accessible_channel_recipients(channel, db)
    await notify_channel_unread(channel_id, channel.server_id, msg.id, current_user.id, accessible_ids)

    return resp

@router.post("/channels/{channel_id}/attachments")
async def upload_channel_attachment(
    channel_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Faz upload de arquivo ou imagem para envio no canal (limite de 50 MB e sanitizado)."""
    await check_rate_limit(
        f"upload:user:{current_user.id}",
        max_requests=10,
        window_seconds=60,
        error_detail="Limite de uploads excedido. Aguarde 1 minuto."
    )
    channel = ensure_channel_access(channel_id, current_user, db)

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

@router.get("/attachments/{filename}")
def get_attachment_file(filename: str):
    """Serve arquivo anexo do canal com suporte ao Backblaze B2, Content-Disposition e cache local."""
    file_path = get_discord_media_file_path(filename)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Anexo não encontrado")

    disp = get_content_disposition_for_file(filename)
    return FileResponse(
        file_path,
        content_disposition_type=disp,
        filename=os.path.basename(filename) if disp == "attachment" else None
    )

@router.delete("/channels/{channel_id}/messages/{message_id}")
async def delete_channel_message(
    channel_id: int,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal não encontrado")

    member = ensure_member(channel.server_id, current_user, db)
    message = db.query(Message).filter(
        Message.id == message_id,
        Message.channel_id == channel_id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")

    if message.author_id != current_user.id and member.role not in ["OWNER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para deletar esta mensagem"
        )

    db.delete(message)
    db.commit()

    # Notifica via WebSocket sobre a remoção da mensagem
    await socket_manager.broadcast_to_channel(
        channel_id,
        {
            "event": "message:delete",
            "message_id": message_id,
            "channel_id": channel_id
        }
    )

    return {"detail": "Mensagem deletada com sucesso"}

@router.patch("/channels/{channel_id}/messages/{message_id}", response_model=MessageResponse)
async def update_channel_message(
    channel_id: int,
    message_id: int,
    payload: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal não encontrado")

    ensure_member(channel.server_id, current_user, db)

    message = db.query(Message).filter(
        Message.id == message_id,
        Message.channel_id == channel_id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")

    if message.author_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você só pode editar suas próprias mensagens"
        )

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="O conteúdo da mensagem não pode ser vazio")

    message.content = content
    message.is_edited = True
    message.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(message)

    reactions = format_message_reactions(message.id, current_user.id, db)
    resp = build_message_response(message, reactions=reactions, author=current_user)

    await socket_manager.broadcast_to_channel(
        channel_id,
        {
            "event": "message:edit",
            "message": resp.model_dump(mode="json")
        }
    )

    return resp

@router.post("/channels/{channel_id}/messages/{message_id}/reactions")
async def toggle_message_reaction(
    channel_id: int,
    message_id: int,
    payload: ReactionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Canal não encontrado")

    ensure_member(channel.server_id, current_user, db)

    message = db.query(Message).filter(
        Message.id == message_id,
        Message.channel_id == channel_id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Mensagem não encontrada")

    emoji = payload.emoji.strip()
    if not emoji:
        raise HTTPException(status_code=400, detail="Emoji inválido")

    existing = db.query(MessageReaction).filter(
        MessageReaction.message_id == message_id,
        MessageReaction.user_id == current_user.id,
        MessageReaction.emoji == emoji
    ).first()

    if existing:
        db.delete(existing)
        action = "removed"
    else:
        new_reaction = MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            emoji=emoji
        )
        db.add(new_reaction)
        action = "added"

    db.commit()

    reactions = format_message_reactions(message_id, current_user.id, db)

    await socket_manager.broadcast_to_channel(
        channel_id,
        {
            "event": "message:reaction",
            "channel_id": channel_id,
            "message_id": message_id,
            "action": action,
            "emoji": emoji,
            "user_id": current_user.id,
            "reactions": [r.model_dump(mode="json") for r in reactions]
        }
    )

    return {
        "action": action,
        "message_id": message_id,
        "reactions": reactions
    }

@router.post("/channels/{channel_id}/messages/{message_id}/forward", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def forward_channel_message(
    channel_id: int,
    message_id: int,
    payload: MessageForwardRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    src_channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not src_channel:
        raise HTTPException(status_code=404, detail="Canal de origem não encontrado")
    ensure_member(src_channel.server_id, current_user, db)

    src_msg = db.query(Message).filter(
        Message.id == message_id,
        Message.channel_id == channel_id
    ).first()
    if not src_msg:
        raise HTTPException(status_code=404, detail="Mensagem de origem não encontrada")

    dest_channel = db.query(Channel).filter(Channel.id == payload.target_channel_id).first()
    if not dest_channel:
        raise HTTPException(status_code=404, detail="Canal de destino não encontrado")
    if dest_channel.type != "TEXT":
        raise HTTPException(status_code=400, detail="Não é possível encaminhar mensagens para canais de voz")
    ensure_member(dest_channel.server_id, current_user, db)

    author_name = src_msg.author.name if src_msg.author else "Usuário"
    forwarded_content = f"↪ Encaminhado de @{author_name}:\n{src_msg.content or ''}".strip()

    new_msg = Message(
        channel_id=dest_channel.id,
        author_id=current_user.id,
        content=forwarded_content,
        attachment_url=src_msg.attachment_url,
        attachment_type=src_msg.attachment_type,
        attachment_size=src_msg.attachment_size
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    resp = build_message_response(new_msg, reactions=[], author=current_user)

    await socket_manager.broadcast_to_channel(
        dest_channel.id,
        {
            "event": "message:new",
            "message": resp.model_dump(mode="json")
        }
    )

    return resp

# ==========================================
# 5. WEBSOCKET REAL-TIME HUB
# ==========================================

@router.websocket("/ws/channels/{channel_id}")
async def channel_websocket_endpoint(
    websocket: WebSocket,
    channel_id: int,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Endpoint WebSocket para mensageria e presença em tempo real por canal."""
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
        return

    # Garante que o usuário participa do servidor e tem permissão de acesso ao canal (inclusive canais privados)
    if not can_user_access_channel(channel, user.id, db):
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Conecta no socket manager
    await socket_manager.connect(channel_id, user.id, user.name, websocket)

    # Notifica os participantes da presença do novo usuário
    await socket_manager.broadcast_to_channel(
        channel_id,
        {
            "event": "presence:join",
            "user_id": user.id,
            "user_name": user.name,
            "online_users": socket_manager.get_online_users_in_channel(channel_id)
        }
    )

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("event")

            # 1. Envio de mensagem pelo próprio WebSocket
            if event_type == "message:send":
                content = (data.get("content") or "").strip()
                attachment_url = data.get("attachment_url")
                if not content and not attachment_url:
                    await websocket.send_json({
                        "event": "error",
                        "detail": "A mensagem precisa conter texto ou anexo"
                    })
                    continue

                if len(content) > 2000:
                    await websocket.send_json({
                        "event": "error",
                        "detail": "Mensagem excede o limite de 2.000 caracteres"
                    })
                    continue

                new_msg = Message(
                    channel_id=channel_id,
                    author_id=user.id,
                    content=content,
                    attachment_url=data.get("attachment_url"),
                    attachment_type=data.get("attachment_type"),
                    attachment_size=data.get("attachment_size"),
                    reply_to_id=data.get("reply_to_id")
                )
                db.add(new_msg)
                db.commit()
                db.refresh(new_msg)

                msg_payload = {
                    "event": "message:new",
                    "message": {
                        "id": new_msg.id,
                        "channel_id": new_msg.channel_id,
                        "author_id": new_msg.author_id,
                        "author_name": user.name,
                        "author_email": user.email,
                        "content": new_msg.content,
                        "attachment_url": new_msg.attachment_url,
                        "attachment_type": new_msg.attachment_type,
                        "attachment_size": new_msg.attachment_size,
                        "reply_to_id": new_msg.reply_to_id,
                        "is_edited": new_msg.is_edited,
                        "is_pinned": bool(getattr(new_msg, "is_pinned", False)),
                        "created_at": ensure_utc(new_msg.created_at).isoformat() if new_msg.created_at else None,
                        "updated_at": ensure_utc(new_msg.updated_at).isoformat() if new_msg.updated_at else None
                    }
                }
                await socket_manager.broadcast_to_channel(channel_id, msg_payload)
                ch_obj = db.query(Channel.server_id).filter(Channel.id == channel_id).first()
                if ch_obj:
                    m_ids = [m.user_id for m in db.query(ServerMember.user_id).filter(ServerMember.server_id == ch_obj.server_id).all()]
                    await notify_channel_unread(channel_id, ch_obj.server_id, new_msg.id, user.id, m_ids)

            # 2. Indicador "Usuário está digitando..."
            elif event_type == "user:typing":
                await socket_manager.broadcast_to_channel(
                    channel_id,
                    {
                        "event": "user:typing",
                        "user_id": user.id,
                        "user_name": user.name
                    },
                    exclude=websocket
                )

            # 3. Heartbeat / ping
            elif event_type == "ping":
                await websocket.send_json({"event": "pong"})

            # 4. Estado de voz (mudo, ensurdecido, falando)
            elif event_type == "voice:state":
                await socket_manager.broadcast_to_channel(
                    channel_id,
                    {
                        "event": "voice:state",
                        "user_id": user.id,
                        "user_name": user.name,
                        "is_muted": bool(data.get("is_muted", False)),
                        "is_deafened": bool(data.get("is_deafened", False)),
                        "is_speaking": bool(data.get("is_speaking", False))
                    },
                    exclude=websocket
                )

            # 5. Sinalização WebRTC (P2P Mesh de Voz)
            elif event_type == "voice:signal":
                await socket_manager.broadcast_to_channel(
                    channel_id,
                    {
                        "event": "voice:signal",
                        "sender_id": user.id,
                        "sender_name": user.name,
                        "target_user_id": data.get("target_user_id"),
                        "signal": data.get("signal")
                    },
                    exclude=websocket
                )

    except WebSocketDisconnect:
        socket_manager.disconnect(channel_id, websocket)
        await socket_manager.broadcast_to_channel(
            channel_id,
            {
                "event": "presence:leave",
                "user_id": user.id,
                "user_name": user.name,
                "online_users": socket_manager.get_online_users_in_channel(channel_id)
            }
        )
    except Exception as e:
        logger.error(f"[WebSocket] Erro na sessão do usuário {user.id} no canal #{channel_id}: {e}")
        socket_manager.disconnect(channel_id, websocket)

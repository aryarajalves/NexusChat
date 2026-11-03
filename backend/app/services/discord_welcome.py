from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.discord_helpers import build_message_response
from app.core.logger import logger
from app.models.discord import (
    DEFAULT_WELCOME_MESSAGE,
    Channel,
    Message,
    Server,
    ServerMember,
)
from app.models.user import User
from app.schemas.discord import ServerMemberResponse, ServerUpdate
from app.services.discord_permissions import get_accessible_channel_recipients
from app.services.socket_manager import notify_channel_unread, socket_manager


def validate_and_apply_welcome_settings(
    server: Server,
    payload: ServerUpdate,
    db: Session,
) -> None:
    """Valida e aplica as configurações de boas-vindas do servidor."""
    if "welcome_channel_id" in payload.model_fields_set:
        if payload.welcome_channel_id is not None:
            ch = (
                db.query(Channel)
                .filter(
                    Channel.id == payload.welcome_channel_id,
                    Channel.server_id == server.id,
                )
                .first()
            )
            if not ch or ch.type != "TEXT":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="O canal de boas-vindas precisa ser um canal de texto válido deste servidor",
                )
        server.welcome_channel_id = payload.welcome_channel_id

    if payload.welcome_enabled is not None:
        server.welcome_enabled = bool(payload.welcome_enabled)

    if payload.welcome_message is not None:
        cleaned = payload.welcome_message.strip()
        server.welcome_message = cleaned if cleaned else DEFAULT_WELCOME_MESSAGE


def render_welcome_message(template: Optional[str], user_name: str, server_name: str) -> str:
    """Formata a mensagem de boas-vindas garantindo a marcação @NomeDoUsuario."""
    raw_template = (template or "").strip() or DEFAULT_WELCOME_MESSAGE
    mention = f"@{user_name}"
    rendered = raw_template.replace("{user}", mention).replace("{server}", server_name)
    if mention not in rendered:
        rendered = f"{mention} {rendered}"
    return rendered[:2000]


async def handle_member_joined_server(
    db: Session,
    server: Server,
    new_member: ServerMember,
    joined_user: User,
) -> Optional[Message]:
    """
    Sincroniza em tempo real a entrada de um novo membro na sidebar de contatos
    e dispara a mensagem de boas-vindas no canal configurado caso esteja ativa.
    """
    try:
        member_rows = (
            db.query(ServerMember.user_id)
            .filter(ServerMember.server_id == server.id)
            .all()
        )
        member_user_ids = [row.user_id for row in member_rows]

        member_resp = ServerMemberResponse(
            id=new_member.id,
            server_id=new_member.server_id,
            user_id=joined_user.id,
            name=joined_user.name,
            email=joined_user.email,
            avatar_url=joined_user.avatar_url,
            nickname=new_member.nickname,
            role=new_member.role,
            role_id=new_member.role_id,
            role_name=new_member.custom_role.name if new_member.custom_role else None,
            role_color=new_member.custom_role.color if new_member.custom_role else None,
            is_online=True,
            joined_at=new_member.joined_at,
        )

        await socket_manager.broadcast_to_users(
            member_user_ids,
            {
                "event": "server:member_joined",
                "server_id": server.id,
                "members_count": len(member_user_ids),
                "member": member_resp.model_dump(mode="json"),
            },
        )
        logger.info(
            f"[Servidor #{server.id}] Novo membro '{joined_user.name}' sincronizado via WebSocket para {len(member_user_ids)} membros."
        )
    except Exception as exc:
        logger.error(
            f"[Servidor #{server.id}] Erro ao transmitir entrada do novo membro '{joined_user.id}': {exc}"
        )

    if not server.welcome_enabled:
        return None

    try:
        target_channel: Optional[Channel] = None
        if server.welcome_channel_id:
            target_channel = (
                db.query(Channel)
                .filter(
                    Channel.id == server.welcome_channel_id,
                    Channel.server_id == server.id,
                    Channel.type == "TEXT",
                )
                .first()
            )

        if not target_channel:
            target_channel = (
                db.query(Channel)
                .filter(
                    Channel.server_id == server.id,
                    Channel.type == "TEXT",
                    Channel.is_private == False,
                )
                .order_by(Channel.position)
                .first()
            )

        if not target_channel:
            logger.warning(
                f"[Boas-Vindas] Servidor #{server.id} está com boas-vindas ativo, mas não possui canal de texto disponível."
            )
            return None

        content = render_welcome_message(server.welcome_message, joined_user.name, server.name)
        welcome_msg = Message(
            channel_id=target_channel.id,
            author_id=server.owner_id,
            content=content,
        )
        db.add(welcome_msg)
        db.commit()
        db.refresh(welcome_msg)

        owner_user = db.query(User).filter(User.id == server.owner_id).first()
        msg_resp = build_message_response(welcome_msg, author=owner_user)

        await socket_manager.broadcast_to_channel(
            target_channel.id,
            {
                "event": "message:new",
                "message": msg_resp.model_dump(mode="json"),
            },
        )

        accessible_ids = get_accessible_channel_recipients(target_channel, db)
        await notify_channel_unread(
            target_channel.id,
            server.id,
            welcome_msg.id,
            0,
            accessible_ids,
        )

        logger.info(
            f"[Boas-Vindas] Mensagem enviada para @{joined_user.name} no canal #{target_channel.name} (Servidor #{server.id})."
        )
        return welcome_msg
    except Exception as exc:
        logger.error(
            f"[Boas-Vindas] Erro ao enviar mensagem automática no servidor #{server.id} para usuário {joined_user.id}: {exc}"
        )
        return None

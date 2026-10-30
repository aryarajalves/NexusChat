"""
Serviço de Validação de Permissões de Acesso a Canais (Públicos e Privados).
"""
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.discord import Channel, Server, ServerMember, ChannelRolePermission
from app.models.user import User
from app.schemas.discord import ChannelResponse
from app.core.logger import logger

def can_user_access_channel(channel: Channel, user_id: int, db: Session) -> bool:
    """
    Verifica se um usuário tem permissão para visualizar e interagir com um canal.
    - Canais públicos: qualquer membro do servidor tem acesso.
    - Canais privados:
      * Dono do servidor (owner_id) e Administradores sempre têm acesso total.
      * Membros com cargo atribuído que conste na lista de allowed_roles do canal têm acesso.
      * Demais membros têm acesso negado.
    """
    # Verifica se o usuário é membro do servidor
    member = db.query(ServerMember).filter(
        ServerMember.server_id == channel.server_id,
        ServerMember.user_id == user_id
    ).first()

    if not member:
        return False

    # Se o canal não é privado, qualquer membro tem acesso
    if not channel.is_private:
        return True

    # Dono do servidor sempre tem acesso total a todos os canais
    server = channel.server or db.query(Server).filter(Server.id == channel.server_id).first()
    if server and server.owner_id == user_id:
        return True

    # Administradores (role='OWNER' ou role='ADMIN' ou cargo com is_admin=True) têm acesso total
    if member.role in ["OWNER", "ADMIN"]:
        return True

    if member.custom_role and member.custom_role.is_admin:
        return True

    # Se o membro possui um cargo personalizado, verifica se esse cargo tem permissão no canal
    if member.role_id:
        has_role_permission = db.query(ChannelRolePermission).filter(
            ChannelRolePermission.channel_id == channel.id,
            ChannelRolePermission.role_id == member.role_id
        ).first() is not None

        if has_role_permission:
            return True

    return False

def ensure_channel_access(channel_id: int, user: User, db: Session) -> Channel:
    """
    Garante que o canal existe e que o usuário tem permissão para acessá-lo.
    Lança HTTPException 404 se não existir e 403 se o usuário não tiver permissão.
    """
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    if not channel:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Canal não encontrado"
        )

    if not can_user_access_channel(channel, user.id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para acessar este canal privado."
        )

    return channel

def get_accessible_channel_recipients(channel: Channel, db: Session) -> List[int]:
    """
    Retorna os IDs de todos os usuários do servidor que possuem permissão de acesso ao canal.
    Utilizado para despachar eventos de unread e notificações apenas para quem pode ver o canal.
    """
    if not channel.is_private:
        members = db.query(ServerMember.user_id).filter(
            ServerMember.server_id == channel.server_id
        ).all()
        return [m[0] for m in members]

    # Para canais privados: Dono + Admins + Membros com cargos permitidos
    server = channel.server or db.query(Server).filter(Server.id == channel.server_id).first()
    owner_id = server.owner_id if server else None

    allowed_role_ids = [
        r[0] for r in db.query(ChannelRolePermission.role_id).filter(
            ChannelRolePermission.channel_id == channel.id
        ).all()
    ]

    all_members = db.query(ServerMember).filter(
        ServerMember.server_id == channel.server_id
    ).all()

    recipient_ids = []
    for m in all_members:
        if m.user_id == owner_id or m.role in ["OWNER", "ADMIN"]:
            recipient_ids.append(m.user_id)
        elif m.custom_role and m.custom_role.is_admin:
            recipient_ids.append(m.user_id)
        elif m.role_id and m.role_id in allowed_role_ids:
            recipient_ids.append(m.user_id)

    return list(set(recipient_ids))

def build_channel_response(channel: Channel) -> ChannelResponse:
    """Constrói o schema ChannelResponse populando allowed_role_ids."""
    allowed_ids = [perm.role_id for perm in channel.allowed_roles] if channel.allowed_roles else []
    return ChannelResponse(
        id=channel.id,
        server_id=channel.server_id,
        name=channel.name,
        type=channel.type,
        category=channel.category,
        position=channel.position,
        is_private=channel.is_private,
        allowed_role_ids=allowed_ids,
        created_at=channel.created_at
    )

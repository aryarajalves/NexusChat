from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.discord import Server, ServerInvite
from app.models.user import User
from app.schemas.discord import ServerInvitePublicInfo

router = APIRouter(prefix="/discord/invites", tags=["discord-invites"])


@router.get("/{code}", response_model=ServerInvitePublicInfo)
def get_server_invite_public_info(
    code: str,
    db: Session = Depends(get_db)
):
    """
    Retorna os detalhes públicos do convite de um servidor para exibição
    na tela de aceite de convite (/invite/:code).
    """
    invite = db.query(ServerInvite).filter(ServerInvite.code == code).first()
    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Convite inválido ou inexistente"
        )

    server = db.query(Server).filter(Server.id == invite.server_id).first()
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Servidor associado ao convite não foi encontrado"
        )

    is_expired = False
    if invite.expires_at:
        exp = invite.expires_at if invite.expires_at.tzinfo else invite.expires_at.replace(tzinfo=timezone.utc)
        if exp < datetime.now(timezone.utc):
            is_expired = True

    if invite.max_uses is not None and invite.current_uses >= invite.max_uses:
        is_expired = True

    inviter = db.query(User).filter(User.id == invite.created_by_id).first() if invite.created_by_id else None

    return ServerInvitePublicInfo(
        code=invite.code,
        server_id=server.id,
        server_name=server.name,
        server_icon=server.icon_url,
        members_count=len(server.members),
        expires_at=invite.expires_at,
        is_expired=is_expired,
        inviter_name=inviter.name if inviter else None,
    )

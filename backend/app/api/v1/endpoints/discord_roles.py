import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.logger import logger
from app.models.user import User
from app.models.discord import Server, ServerMember, ServerRole
from app.schemas.discord import (
    ServerRoleCreate,
    ServerRoleUpdate,
    ServerRoleResponse,
    ServerMemberResponse,
    ServerMemberRoleUpdate,
    ServerResponse,
)
from app.api.v1.endpoints.users import get_current_user
from app.services.storage import upload_discord_media_file, DISCORD_UPLOAD_DIR

router = APIRouter(prefix="/discord", tags=["Discord Server Roles & Settings"])

UPLOAD_DIR = DISCORD_UPLOAD_DIR
ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def get_member(server_id: int, user_id: int, db: Session) -> Optional[ServerMember]:
    return db.query(ServerMember).filter(
        ServerMember.server_id == server_id,
        ServerMember.user_id == user_id
    ).first()


def ensure_can_manage(server_id: int, current_user: User, db: Session) -> Server:
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")
    
    if server.owner_id == current_user.id or current_user.role == "superadmin":
        return server
    
    member = get_member(server_id, current_user.id, db)
    if not member:
        raise HTTPException(status_code=403, detail="Você não é membro deste servidor")
    
    # Verifica se tem role ADMIN no servidor ou cargo com is_admin
    is_admin = member.role in ["OWNER", "ADMIN"]
    if not is_admin and member.custom_role and member.custom_role.is_admin:
        is_admin = True
    
    if not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Apenas administradores ou o criador do servidor podem gerenciar cargos e configurações."
        )
    return server


@router.get("/servers/{server_id}/roles", response_model=List[ServerRoleResponse])
def list_server_roles(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Lista todos os cargos personalizados do servidor."""
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Servidor não encontrado")
    
    member = get_member(server_id, current_user.id, db)
    if not member and server.owner_id != current_user.id and current_user.role != "superadmin":
        raise HTTPException(status_code=403, detail="Você não é membro deste servidor")

    roles = db.query(ServerRole).filter(ServerRole.server_id == server_id).order_by(ServerRole.position.desc(), ServerRole.id.asc()).all()
    
    results = []
    for r in roles:
        count = db.query(ServerMember).filter(ServerMember.role_id == r.id).count()
        results.append(ServerRoleResponse(
            id=r.id,
            server_id=r.server_id,
            name=r.name,
            color=r.color,
            position=r.position,
            is_admin=r.is_admin,
            hoist=r.hoist,
            created_at=r.created_at,
            members_count=count
        ))
    return results


@router.post("/servers/{server_id}/roles", response_model=ServerRoleResponse, status_code=status.HTTP_201_CREATED)
def create_server_role(
    server_id: int,
    payload: ServerRoleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cria um novo cargo no servidor (requer permissão de administrador ou dono)."""
    ensure_can_manage(server_id, current_user, db)

    # Cor padrão ou limpa
    color = payload.color.strip() if payload.color else "#99aab5"
    if not color.startswith("#"):
        color = f"#{color}"

    new_role = ServerRole(
        server_id=server_id,
        name=payload.name.strip(),
        color=color,
        position=payload.position or 0,
        is_admin=bool(payload.is_admin),
        hoist=bool(payload.hoist)
    )
    db.add(new_role)
    db.commit()
    db.refresh(new_role)

    logger.info(f"Cargo '{new_role.name}' criado no servidor ID {server_id} pelo usuário {current_user.email}")
    return ServerRoleResponse(
        id=new_role.id,
        server_id=new_role.server_id,
        name=new_role.name,
        color=new_role.color,
        position=new_role.position,
        is_admin=new_role.is_admin,
        hoist=new_role.hoist,
        created_at=new_role.created_at,
        members_count=0
    )


@router.patch("/servers/{server_id}/roles/{role_id}", response_model=ServerRoleResponse)
def update_server_role(
    server_id: int,
    role_id: int,
    payload: ServerRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atualiza as propriedades de um cargo existente."""
    ensure_can_manage(server_id, current_user, db)

    role = db.query(ServerRole).filter(ServerRole.id == role_id, ServerRole.server_id == server_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Cargo não encontrado neste servidor")

    if payload.name is not None:
        role.name = payload.name.strip()
    if payload.color is not None:
        color = payload.color.strip()
        if not color.startswith("#"):
            color = f"#{color}"
        role.color = color
    if payload.position is not None:
        role.position = payload.position
    if payload.is_admin is not None:
        role.is_admin = payload.is_admin
    if payload.hoist is not None:
        role.hoist = payload.hoist

    db.commit()
    db.refresh(role)

    count = db.query(ServerMember).filter(ServerMember.role_id == role.id).count()
    return ServerRoleResponse(
        id=role.id,
        server_id=role.server_id,
        name=role.name,
        color=role.color,
        position=role.position,
        is_admin=role.is_admin,
        hoist=role.hoist,
        created_at=role.created_at,
        members_count=count
    )


@router.delete("/servers/{server_id}/roles/{role_id}")
def delete_server_role(
    server_id: int,
    role_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Exclui um cargo do servidor (membros que possuíam o cargo voltam a não ter cargo)."""
    ensure_can_manage(server_id, current_user, db)

    role = db.query(ServerRole).filter(ServerRole.id == role_id, ServerRole.server_id == server_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Cargo não encontrado neste servidor")

    role_name = role.name
    db.delete(role)
    db.commit()

    logger.info(f"Cargo '{role_name}' excluído do servidor ID {server_id} pelo usuário {current_user.email}")
    return {"message": f"Cargo '{role_name}' excluído com sucesso."}


@router.patch("/servers/{server_id}/members/{member_id}/role", response_model=ServerMemberResponse)
def update_member_role(
    server_id: int,
    member_id: int,
    payload: ServerMemberRoleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Atribui ou remove um cargo personalizado a um membro do servidor."""
    server = ensure_can_manage(server_id, current_user, db)

    member = db.query(ServerMember).filter(ServerMember.id == member_id, ServerMember.server_id == server_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Membro não encontrado neste servidor")

    # Não permite rebaixar o owner
    if member.user_id == server.owner_id and member.role != "OWNER":
        member.role = "OWNER"

    if payload.role_id is None:
        member.role_id = None
        if member.user_id != server.owner_id and member.role == "ADMIN":
            member.role = "MEMBER"
    else:
        role = db.query(ServerRole).filter(ServerRole.id == payload.role_id, ServerRole.server_id == server_id).first()
        if not role:
            raise HTTPException(status_code=404, detail="Cargo especificado não existe neste servidor")
        member.role_id = role.id
        if role.is_admin and member.user_id != server.owner_id:
            member.role = "ADMIN"

    db.commit()
    db.refresh(member)

    role_name = member.custom_role.name if member.custom_role else None
    role_color = member.custom_role.color if member.custom_role else None

    return ServerMemberResponse(
        id=member.id,
        server_id=member.server_id,
        user_id=member.user_id,
        name=member.user.name if member.user else "Usuário Desconhecido",
        email=member.user.email if member.user else "",
        nickname=member.nickname,
        role=member.role,
        role_id=member.role_id,
        role_name=role_name,
        role_color=role_color,
        joined_at=member.joined_at
    )


@router.post("/servers/{server_id}/icon")
async def upload_server_icon(
    server_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Faz upload da imagem do ícone do servidor."""
    server = ensure_can_manage(server_id, current_user, db)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato de imagem inválido. Use PNG, JPG, GIF ou WEBP.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="O arquivo não pode ultrapassar 10 MB.")

    unique_name = f"icon_{server_id}_{uuid.uuid4().hex[:10]}{ext}"
    upload_res = upload_discord_media_file(file_bytes, unique_name, file.content_type)
    icon_url = upload_res["attachment_url"]
    server.icon_url = icon_url
    db.commit()
    db.refresh(server)

    logger.info(f"Ícone do servidor ID {server_id} atualizado com sucesso.")
    return {"icon_url": icon_url, "message": "Ícone atualizado com sucesso!"}


@router.post("/servers/{server_id}/banner")
async def upload_server_banner(
    server_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Faz upload da imagem do banner do servidor."""
    server = ensure_can_manage(server_id, current_user, db)

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Formato de imagem inválido. Use PNG, JPG, GIF ou WEBP.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="O arquivo não pode ultrapassar 10 MB.")

    unique_name = f"banner_{server_id}_{uuid.uuid4().hex[:10]}{ext}"
    upload_res = upload_discord_media_file(file_bytes, unique_name, file.content_type)
    banner_url = upload_res["attachment_url"]
    server.banner_url = banner_url
    db.commit()
    db.refresh(server)

    logger.info(f"Banner do servidor ID {server_id} atualizado com sucesso.")
    return {"banner_url": banner_url, "message": "Banner atualizado com sucesso!"}

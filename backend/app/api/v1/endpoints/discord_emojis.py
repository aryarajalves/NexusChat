"""
Endpoints para Gerenciamento de Emojis Customizados de Servidores (Discord Emojis).
Permite listar, fazer upload (PNG, JPG, GIF, WEBP) e excluir emojis personalizados por servidor.
"""
import os
import re
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.logger import logger
from app.models.user import User
from app.models.discord import Server, ServerMember, ServerRole, ServerEmoji
from app.schemas.discord import ServerEmojiResponse
from app.api.v1.endpoints.users import get_current_user
from app.services.storage import upload_discord_media_file, delete_discord_media_file

router = APIRouter(prefix="/discord", tags=["discord-emojis"])

ALLOWED_EMOJI_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
MAX_EMOJI_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def ensure_server_member(server_id: int, current_user: User, db: Session) -> Server:
    """Valida se o servidor existe e se o usuário atual é membro dele ou superadmin."""
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servidor não encontrado.")

    if getattr(current_user, "role", "") == "superadmin" or getattr(current_user, "is_superuser", False):
        return server

    if server.owner_id == current_user.id:
        return server

    member = (
        db.query(ServerMember)
        .filter(ServerMember.server_id == server_id, ServerMember.user_id == current_user.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não é membro deste servidor.")

    return server


def ensure_can_manage_emojis(server_id: int, current_user: User, db: Session) -> Server:
    """Valida se o usuário tem privilégio de Dono, Administrador ou Super Admin para gerenciar emojis."""
    server = db.query(Server).filter(Server.id == server_id).first()
    if not server:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Servidor não encontrado.")

    if getattr(current_user, "role", "") == "superadmin" or getattr(current_user, "is_superuser", False):
        return server

    if server.owner_id == current_user.id:
        return server

    member = (
        db.query(ServerMember)
        .filter(ServerMember.server_id == server_id, ServerMember.user_id == current_user.id)
        .first()
    )
    if not member:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Você não tem permissão para gerenciar emojis.")

    if member.role in ["OWNER", "ADMIN"]:
        return server

    if member.role_id:
        role = db.query(ServerRole).filter(ServerRole.id == member.role_id).first()
        if role and role.is_admin:
            return server

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas administradores podem gerenciar emojis deste servidor.")


@router.get("/servers/{server_id}/emojis", response_model=List[ServerEmojiResponse])
def list_server_emojis(
    server_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retorna a lista de emojis customizados do servidor."""
    ensure_server_member(server_id, current_user, db)
    emojis = (
        db.query(ServerEmoji)
        .filter(ServerEmoji.server_id == server_id)
        .order_by(ServerEmoji.created_at.asc())
        .all()
    )
    return emojis


@router.post("/servers/{server_id}/emojis", response_model=ServerEmojiResponse, status_code=status.HTTP_201_CREATED)
async def upload_server_emoji(
    server_id: int,
    name: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cadastra um novo emoji customizado no servidor.
    Suporta PNG, JPG, GIF e WEBP até 5 MB.
    """
    server = ensure_can_manage_emojis(server_id, current_user, db)

    # Limpa e valida o nome do emoji
    clean_name = name.strip().replace(":", "").lower()
    if not re.match(r"^[a-zA-Z0-9_]{2,32}$", clean_name):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O nome do emoji deve ter entre 2 e 32 caracteres (apenas letras, números e underline).",
        )

    # Verifica se já existe emoji com esse nome no servidor
    existing = (
        db.query(ServerEmoji)
        .filter(ServerEmoji.server_id == server.id, ServerEmoji.name == clean_name)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Já existe um emoji chamado ':{clean_name}:' neste servidor.",
        )

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EMOJI_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Use arquivos PNG, JPG, GIF ou WEBP.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_EMOJI_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A imagem do emoji não pode ultrapassar 5 MB.",
        )

    unique_filename = f"emoji_{server_id}_{clean_name}_{uuid.uuid4().hex[:8]}{ext}"
    content_type = file.content_type or ("image/gif" if ext == ".gif" else "image/png")

    upload_res = upload_discord_media_file(
        file_bytes=file_bytes,
        filename=unique_filename,
        content_type=content_type,
    )

    image_url = upload_res.get("attachment_url")
    if not image_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao armazenar imagem do emoji.",
        )

    emoji = ServerEmoji(
        server_id=server.id,
        user_id=current_user.id,
        name=clean_name,
        image_url=image_url,
    )
    db.add(emoji)
    db.commit()
    db.refresh(emoji)

    logger.info(f"[Emoji] Emoji :{clean_name}: adicionado ao servidor {server_id} pelo usuário {current_user.id}.")
    return emoji


@router.delete("/servers/{server_id}/emojis/{emoji_id}")
def delete_server_emoji(
    server_id: int,
    emoji_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Exclui um emoji customizado do servidor e remove a mídia física."""
    server = ensure_can_manage_emojis(server_id, current_user, db)

    emoji = (
        db.query(ServerEmoji)
        .filter(ServerEmoji.id == emoji_id, ServerEmoji.server_id == server.id)
        .first()
    )
    if not emoji:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emoji não encontrado.")

    # Remove o arquivo físico se possível
    filename = os.path.basename(emoji.image_url)
    if filename:
        try:
            delete_discord_media_file(filename)
        except Exception as err:
            logger.warning(f"[Emoji] Falha ao deletar arquivo físico do emoji {emoji.id}: {err}")

    db.delete(emoji)
    db.commit()

    logger.info(f"[Emoji] Emoji :{emoji.name}: (ID: {emoji_id}) excluído do servidor {server_id}.")
    return {"status": "deleted", "id": emoji_id}

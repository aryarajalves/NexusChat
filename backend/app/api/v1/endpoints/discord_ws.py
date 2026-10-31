from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.services.socket_manager import socket_manager
from app.core.logger import logger

router = APIRouter(prefix="/discord", tags=["discord-ws"])


@router.websocket("/ws/me")
async def user_notification_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Endpoint WebSocket persistente para notificações, mensagens não lidas
    e eventos em tempo real do usuário autenticado.
    """
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    sub = payload.get("sub")
    user = db.query(User).filter(
        or_(User.email == str(sub), User.id == (int(sub) if str(sub).isdigit() else -1)),
        User.is_active == True
    ).first()
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    if user.id not in socket_manager.user_sockets:
        socket_manager.user_sockets[user.id] = set()
    socket_manager.user_sockets[user.id].add(websocket)
    socket_manager.socket_users[websocket] = (user.id, user.name)

    logger.info(f"[WebSocket User] Usuário {user.name} ({user.id}) conectado ao canal global de notificações")

    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type") or data.get("event")
            if event_type == "ping":
                await websocket.send_json({"type": "pong", "event": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"[WebSocket User] Erro na sessão global do usuário {user.id}: {e}")
    finally:
        if user.id in socket_manager.user_sockets:
            socket_manager.user_sockets[user.id].discard(websocket)
            if not socket_manager.user_sockets[user.id]:
                del socket_manager.user_sockets[user.id]
        socket_manager.socket_users.pop(websocket, None)
        logger.info(f"[WebSocket User] Usuário {user.name} ({user.id}) desconectado do canal global de notificações")

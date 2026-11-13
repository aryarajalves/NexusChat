import asyncio
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db_context
from app.core.security import decode_access_token
from app.models.user import User
from app.services.socket_manager import socket_manager
from app.core.logger import logger

router = APIRouter(prefix="/discord", tags=["discord-ws"])


@router.websocket("/ws/me")
async def user_notification_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None)
):
    """
    Endpoint WebSocket persistente para notificações, mensagens não lidas
    e eventos em tempo real do usuário autenticado.
    Não segura conexão do banco de dados no loop persistente (zero pool leak).
    """
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    sub = payload.get("sub")
    with get_db_context() as db:
        user_record = db.query(User).filter(
            or_(User.email == str(sub), User.id == (int(sub) if str(sub).isdigit() else -1)),
            User.is_active == True
        ).first()
        if not user_record:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id = user_record.id
        user_name = user_record.name

    token_iat = payload.get("iat", 0)
    # Rejeita imediatamente conexões de abas antigas portando tokens obsoletos revogados por novo login
    if not socket_manager.is_token_active(user_id, token, token_iat):
        logger.warning(f"[WebSocket User] Rejeitando token antigo/revogado para usuário {user_id}")
        await websocket.close(code=4001, reason="Sessao expirada por novo login")
        return

    socket_manager.register_active_token(user_id, token, token_iat)

    # Se o usuário já possuir conexões ativas de outra sessão/aba/dispositivo no canal /ws/me, desconecta a anterior
    if user_id in socket_manager.user_sockets:
        for old_ws in list(socket_manager.user_sockets[user_id]):
            if old_ws not in socket_manager.ws_sessions:
                continue
            old_sid = socket_manager.ws_sessions.get(old_ws)
            is_same_session = bool(session_id and old_sid and session_id == old_sid)
            if old_ws != websocket and not is_same_session:
                try:
                    await old_ws.send_json({
                        "event": "session:terminated",
                        "reason": "new_login",
                        "detail": "Sua conta foi conectada em outra aba ou dispositivo."
                    })
                    await old_ws.close(code=4001, reason="Nova sessao iniciada em outra aba")
                except Exception:
                    pass
                finally:
                    socket_manager.ws_sessions.pop(old_ws, None)
                    if user_id in socket_manager.user_sockets:
                        socket_manager.user_sockets[user_id].discard(old_ws)

    await websocket.accept()
    if session_id:
        socket_manager.ws_sessions[websocket] = session_id
    was_offline = not socket_manager.is_user_online(user_id)
    if user_id not in socket_manager.user_sockets:
        socket_manager.user_sockets[user_id] = set()
    socket_manager.user_sockets[user_id].add(websocket)
    socket_manager.socket_users[websocket] = (user_id, user_name)

    if was_offline:
        online_ids = [uid for uid in list(socket_manager.user_sockets.keys()) if uid != user_id]
        if online_ids:
            await socket_manager.broadcast_to_users(
                online_ids,
                {"event": "user:presence", "user_id": user_id, "is_online": True},
            )

    logger.info(f"[WebSocket User] Usuário {user_name} ({user_id}) conectado ao canal global de notificações")

    try:
        while True:
            data = await asyncio.wait_for(websocket.receive_json(), timeout=60.0)
            event_type = data.get("type") or data.get("event")
            if event_type == "ping":
                await websocket.send_json({"type": "pong", "event": "pong"})
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception as e:
        logger.error(f"[WebSocket User] Erro na sessão global do usuário {user_id}: {e}")
    finally:
        socket_manager.ws_sessions.pop(websocket, None)
        if user_id in socket_manager.user_sockets:
            socket_manager.user_sockets[user_id].discard(websocket)
            if not socket_manager.user_sockets[user_id]:
                del socket_manager.user_sockets[user_id]
        socket_manager.socket_users.pop(websocket, None)

        if not socket_manager.is_user_online(user_id):
            await socket_manager.remove_user_from_all_voice_rooms(user_id, user_name)
            online_ids = list(socket_manager.user_sockets.keys())
            if online_ids:
                await socket_manager.broadcast_to_users(
                    online_ids,
                    {"event": "user:presence", "user_id": user_id, "is_online": False},
                )

        logger.info(f"[WebSocket User] Usuário {user_name} ({user_id}) desconectado do canal global de notificações")

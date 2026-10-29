import asyncio
import json
import uuid
from typing import Dict, Set, List, Any, Optional
from fastapi import WebSocket
from app.core.logger import logger
from app.core.config import settings

try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None

NODE_ID = str(uuid.uuid4())[:8]
REDIS_PUBSUB_CHANNEL = "nexus:pubsub:events"


class ConnectionManager:
    """
    Gerencia conexões WebSocket ativas agrupadas por canais (salas) e DMs.
    Possui suporte híbrido a Redis Pub/Sub para escala horizontal (múltiplos workers/containers)
    com fallback automático e transparente para memória local (in-memory).
    """

    def __init__(self):
        # Mapeamento: channel_id -> set de instâncias WebSocket locais neste worker
        self.channel_rooms: Dict[int, Set[WebSocket]] = {}
        # Mapeamento: dm_conversation_id -> set de instâncias WebSocket locais
        self.dm_rooms: Dict[int, Set[WebSocket]] = {}
        # Mapeamento: websocket -> (user_id, user_name)
        self.socket_users: Dict[WebSocket, tuple[int, str]] = {}
        # Mapeamento: user_id -> set de instâncias WebSocket locais
        self.user_sockets: Dict[int, Set[WebSocket]] = {}

        # Conexão e task do Redis Pub/Sub
        self.redis_client = None
        self.pubsub_task: Optional[asyncio.Task] = None
        self.is_connected_to_redis = False

    async def init_redis(self):
        """Inicializa a conexão assíncrona com o Redis para Pub/Sub e presença distribuída."""
        if not settings.REDIS_URL or not aioredis:
            logger.info("[WebSocket] Redis Pub/Sub não configurado. Operando em modo in-memory local.")
            return

        try:
            self.redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            await self.redis_client.ping()
            self.is_connected_to_redis = True
            self.pubsub_task = asyncio.create_task(self._redis_subscriber_loop())
            logger.info(f"[WebSocket] Redis Pub/Sub conectado com sucesso (Node: {NODE_ID})")
        except Exception as e:
            logger.warning(f"[WebSocket] Falha ao conectar ao Redis ({e}). Operando em modo in-memory local.")
            self.is_connected_to_redis = False
            self.redis_client = None

    async def close_redis(self):
        """Encerra a conexão com o Redis e cancela a task de escuta do barramento."""
        if self.pubsub_task:
            self.pubsub_task.cancel()
            try:
                await self.pubsub_task
            except asyncio.CancelledError:
                pass
            self.pubsub_task = None

        if self.redis_client:
            try:
                await self.redis_client.close()
            except Exception:
                pass
            self.redis_client = None
        self.is_connected_to_redis = False

    async def _redis_subscriber_loop(self):
        """Escuta eventos do barramento Redis Pub/Sub e distribui para as conexões locais."""
        try:
            pubsub = self.redis_client.pubsub()
            await pubsub.subscribe(REDIS_PUBSUB_CHANNEL)
            logger.info(f"[WebSocket] Inscrito no canal Redis Pub/Sub: {REDIS_PUBSUB_CHANNEL}")

            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                try:
                    payload_raw = message.get("data")
                    if not payload_raw:
                        continue
                    event = json.loads(payload_raw)
                    event_type = event.get("type")
                    target_id = event.get("target_id")
                    data = event.get("data")

                    if event_type == "channel":
                        await self._local_broadcast_to_channel(target_id, data)
                    elif event_type == "dm":
                        await self._local_broadcast_to_dm(target_id, data)
                    elif event_type == "user":
                        await self._local_broadcast_to_user(target_id, data)
                except Exception as ex:
                    logger.error(f"[WebSocket] Erro ao processar mensagem do Redis Pub/Sub: {ex}")
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"[WebSocket] Erro na loop do Redis Pub/Sub: {e}")
            self.is_connected_to_redis = False

    async def _publish_event(self, event_type: str, target_id: int, data: Dict[str, Any]):
        """Publica no Redis Pub/Sub ou faz entrega local direta se o Redis não estiver ativo."""
        if self.is_connected_to_redis and self.redis_client:
            try:
                message = json.dumps({
                    "type": event_type,
                    "target_id": target_id,
                    "data": data,
                    "sender_node": NODE_ID,
                })
                await self.redis_client.publish(REDIS_PUBSUB_CHANNEL, message)
                return
            except Exception as e:
                logger.error(f"[WebSocket] Falha ao publicar no Redis ({e}). Fallback para in-memory.")

        # Fallback local in-memory
        if event_type == "channel":
            await self._local_broadcast_to_channel(target_id, data)
        elif event_type == "dm":
            await self._local_broadcast_to_dm(target_id, data)
        elif event_type == "user":
            await self._local_broadcast_to_user(target_id, data)

    # --- Handshake e Conexões Locais ---
    async def connect(self, channel_id: int, user_id: int, user_name: str, websocket: WebSocket):
        """Aceita o handshake e adiciona a conexão à sala do canal."""
        await websocket.accept()
        if channel_id not in self.channel_rooms:
            self.channel_rooms[channel_id] = set()
        self.channel_rooms[channel_id].add(websocket)
        self.socket_users[websocket] = (user_id, user_name)
        if user_id not in self.user_sockets:
            self.user_sockets[user_id] = set()
        self.user_sockets[user_id].add(websocket)

        if self.is_connected_to_redis and self.redis_client:
            try:
                await self.redis_client.sadd(f"nexus:channel:{channel_id}:users", f"{user_id}:{user_name}")
                await self.redis_client.sadd("nexus:online_users", user_id)
            except Exception as e:
                logger.error(f"[WebSocket] Erro ao registrar presença no Redis: {e}")

        logger.info(f"[WebSocket] Usuário {user_name} (ID: {user_id}) conectado ao canal #{channel_id}")

    def disconnect(self, channel_id: int, websocket: WebSocket):
        """Remove a conexão da sala do canal."""
        if channel_id in self.channel_rooms:
            self.channel_rooms[channel_id].discard(websocket)
            if not self.channel_rooms[channel_id]:
                del self.channel_rooms[channel_id]

        user_info = self.socket_users.pop(websocket, None)
        if user_info:
            uid, uname = user_info
            if uid in self.user_sockets:
                self.user_sockets[uid].discard(websocket)
                if not self.user_sockets[uid]:
                    del self.user_sockets[uid]

            if self.is_connected_to_redis and self.redis_client:
                try:
                    asyncio.create_task(self.redis_client.srem(f"nexus:channel:{channel_id}:users", f"{uid}:{uname}"))
                    if uid not in self.user_sockets:
                        asyncio.create_task(self.redis_client.srem("nexus:online_users", uid))
                except Exception:
                    pass

            logger.info(f"[WebSocket] Usuário {uname} desconectado do canal #{channel_id}")

    # --- Entrega Local nos WebSockets ---
    async def _local_broadcast_to_channel(self, channel_id: int, data: Dict[str, Any], exclude: WebSocket = None):
        """Entrega o payload JSON para todos os clientes conectados localmente no canal."""
        if channel_id not in self.channel_rooms:
            return

        dead_sockets = []
        for connection in list(self.channel_rooms[channel_id]):
            if connection == exclude:
                continue
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.error(f"[WebSocket] Erro ao enviar para socket no canal #{channel_id}: {e}")
                dead_sockets.append(connection)

        for dead in dead_sockets:
            self.disconnect(channel_id, dead)

    async def broadcast_to_channel(self, channel_id: int, data: Dict[str, Any], exclude: WebSocket = None):
        """Publica evento no barramento de canais (Redis Pub/Sub se ativo, ou in-memory)."""
        await self._publish_event("channel", channel_id, data)

    def get_online_users_in_channel(self, channel_id: int) -> List[Dict[str, Any]]:
        """Retorna a lista de usuários únicos com conexão ativa no canal."""
        if channel_id not in self.channel_rooms:
            return []

        seen_ids = set()
        users = []
        for ws in self.channel_rooms[channel_id]:
            if ws in self.socket_users:
                uid, name = self.socket_users[ws]
                if uid not in seen_ids:
                    seen_ids.add(uid)
                    users.append({"user_id": uid, "user_name": name})
        return users

    # --- Suporte a DMs (Mensagens Diretas) ---
    async def connect_dm(self, conversation_id: int, user_id: int, user_name: str, websocket: WebSocket):
        """Aceita conexão WebSocket para sala de DM."""
        await websocket.accept()
        if conversation_id not in self.dm_rooms:
            self.dm_rooms[conversation_id] = set()
        self.dm_rooms[conversation_id].add(websocket)
        self.socket_users[websocket] = (user_id, user_name)
        if user_id not in self.user_sockets:
            self.user_sockets[user_id] = set()
        self.user_sockets[user_id].add(websocket)
        logger.info(f"[WebSocket DM] Usuário {user_name} (ID: {user_id}) conectado à DM #{conversation_id}")

    def disconnect_dm(self, conversation_id: int, websocket: WebSocket):
        """Remove conexão da sala de DM."""
        if conversation_id in self.dm_rooms:
            self.dm_rooms[conversation_id].discard(websocket)
            if not self.dm_rooms[conversation_id]:
                del self.dm_rooms[conversation_id]

        user_info = self.socket_users.pop(websocket, None)
        if user_info:
            uid = user_info[0]
            if uid in self.user_sockets:
                self.user_sockets[uid].discard(websocket)
                if not self.user_sockets[uid]:
                    del self.user_sockets[uid]
            logger.info(f"[WebSocket DM] Usuário {user_info[1]} desconectado da DM #{conversation_id}")

    async def _local_broadcast_to_dm(self, conversation_id: int, data: Dict[str, Any], exclude: WebSocket = None):
        """Entrega payload JSON local para os participantes conectados na DM."""
        if conversation_id not in self.dm_rooms:
            return

        dead_sockets = []
        for connection in list(self.dm_rooms[conversation_id]):
            if connection == exclude:
                continue
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.error(f"[WebSocket DM] Erro ao enviar mensagem para socket na DM #{conversation_id}: {e}")
                dead_sockets.append(connection)

        for dead in dead_sockets:
            self.disconnect_dm(conversation_id, dead)

    async def broadcast_to_dm(self, conversation_id: int, data: Dict[str, Any], exclude: WebSocket = None):
        """Publica evento no barramento de DMs (Redis Pub/Sub se ativo, ou in-memory)."""
        await self._publish_event("dm", conversation_id, data)

    async def _local_broadcast_to_user(self, user_id: int, data: Dict[str, Any]):
        """Entrega payload JSON local para todas as conexões ativas de um usuário."""
        if user_id not in self.user_sockets:
            return

        dead_sockets = []
        for connection in list(self.user_sockets[user_id]):
            try:
                await connection.send_json(data)
            except Exception as e:
                logger.error(f"[WebSocket] Erro ao enviar para usuário {user_id}: {e}")
                dead_sockets.append(connection)

        for dead in dead_sockets:
            self.user_sockets[user_id].discard(dead)

    async def broadcast_to_user(self, user_id: int, data: Dict[str, Any]):
        """Publica evento no barramento para um usuário específico."""
        await self._publish_event("user", user_id, data)

    async def broadcast_to_users(self, user_ids: List[int], data: Dict[str, Any]):
        """Envia payload JSON para múltiplos usuários específicos."""
        for uid in user_ids:
            await self.broadcast_to_user(uid, data)


# Instância singleton para uso em toda a aplicação
socket_manager = ConnectionManager()


async def notify_channel_unread(channel_id: int, server_id: int, message_id: int, author_id: int, member_user_ids: List[int]):
    """Envia notificação de mensagem não lida para todos os membros do servidor (exceto autor)."""
    recipients = [uid for uid in member_user_ids if uid != author_id]
    if recipients:
        await socket_manager.broadcast_to_users(
            recipients,
            {
                "event": "unread:update",
                "type": "channel",
                "channel_id": channel_id,
                "server_id": server_id,
                "message_id": message_id,
            },
        )


async def notify_dm_unread(conversation_id: int, message_id: int, recipient_user_id: int):
    """Envia notificação de mensagem não lida para o outro participante da DM."""
    await socket_manager.broadcast_to_user(
        recipient_user_id,
        {
            "event": "unread:update",
            "type": "dm",
            "conversation_id": conversation_id,
            "message_id": message_id,
        },
    )

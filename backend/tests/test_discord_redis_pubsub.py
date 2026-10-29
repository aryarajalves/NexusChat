import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.config import settings
from app.services.socket_manager import (
    ConnectionManager,
    REDIS_PUBSUB_CHANNEL,
    NODE_ID
)

@pytest.mark.asyncio
async def test_redis_init_fallback_when_no_redis_url():
    """Valida fallback gracioso para in-memory quando REDIS_URL não está configurada."""
    manager = ConnectionManager()
    with patch.object(settings, "REDIS_URL", ""):
        await manager.init_redis()
        assert manager.is_connected_to_redis is False
        assert manager.redis_client is None

@pytest.mark.asyncio
async def test_redis_init_connection_success():
    """Valida inicialização do cliente Redis e disparo da task de escuta do barramento."""
    manager = ConnectionManager()
    mock_redis = AsyncMock()
    mock_redis.ping.return_value = True
    mock_pubsub = MagicMock()
    mock_pubsub.subscribe = AsyncMock()

    async def fake_listen():
        if False:
            yield {}

    mock_pubsub.listen = fake_listen
    mock_redis.pubsub.return_value = mock_pubsub

    with patch.object(settings, "REDIS_URL", "redis://localhost:6379/0"):
        with patch("redis.asyncio.from_url", return_value=mock_redis):
            await manager.init_redis()
            assert manager.is_connected_to_redis is True
            assert manager.pubsub_task is not None

            # Limpeza
            await manager.close_redis()
            assert manager.is_connected_to_redis is False

@pytest.mark.asyncio
async def test_broadcast_publishes_to_redis():
    """Valida que chamadas de broadcast publicam evento JSON no canal do Redis."""
    manager = ConnectionManager()
    mock_redis = AsyncMock()
    manager.redis_client = mock_redis
    manager.is_connected_to_redis = True

    payload = {"content": "Olá via cluster", "id": 42}
    await manager.broadcast_to_channel(channel_id=10, data=payload)

    mock_redis.publish.assert_called_once()
    channel, message_str = mock_redis.publish.call_args[0]
    assert channel == REDIS_PUBSUB_CHANNEL

    parsed = json.loads(message_str)
    assert parsed["type"] == "channel"
    assert parsed["target_id"] == 10
    assert parsed["data"]["content"] == "Olá via cluster"
    assert parsed["sender_node"] == NODE_ID

@pytest.mark.asyncio
async def test_redis_subscriber_delivers_to_local_sockets():
    """Valida que o loop subscriber entrega eventos recebidos do Redis para os sockets locais daquele canal."""
    manager = ConnectionManager()
    mock_ws = AsyncMock()

    # Registra socket local no canal #5
    manager.channel_rooms[5] = {mock_ws}

    # Simula entrega local
    await manager._local_broadcast_to_channel(5, {"content": "Mensagem recebida de outra instância"})

    mock_ws.send_json.assert_called_once_with({"content": "Mensagem recebida de outra instância"})

@pytest.mark.asyncio
async def test_in_memory_fallback_broadcast_when_redis_offline():
    """Valida entrega direta em memória caso o Redis esteja indisponível."""
    manager = ConnectionManager()
    manager.is_connected_to_redis = False

    mock_ws = AsyncMock()
    manager.channel_rooms[7] = {mock_ws}

    await manager.broadcast_to_channel(7, {"msg": "offline-safe"})
    mock_ws.send_json.assert_called_once_with({"msg": "offline-safe"})

import time
from typing import Dict, Any, Optional
from jose import jwt
from app.core.config import settings
from app.core.logger import logger

def generate_livekit_token(
    channel_id: int,
    user_id: int,
    user_name: str,
    ttl_seconds: int = 6 * 3600
) -> str:
    """
    Gera um AccessToken JWT em conformidade com a especificação oficial do LiveKit SFU.
    Permite que o usuário publique áudio/vídeo e assine fluxos de outros membros na sala.
    """
    now = int(time.time())
    room_name = f"channel_{channel_id}"
    identity = f"user_{user_id}"

    payload: Dict[str, Any] = {
        "iss": settings.LIVEKIT_API_KEY,
        "sub": identity,
        "name": user_name,
        "nbf": now - 5,
        "exp": now + ttl_seconds,
        "video": {
            "room": room_name,
            "roomJoin": True,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        },
        "metadata": f'{{"user_id": {user_id}, "name": "{user_name}"}}',
    }

    try:
        token = jwt.encode(payload, settings.LIVEKIT_API_SECRET, algorithm="HS256")
        return token
    except Exception as e:
        logger.error(f"[LiveKit] Erro ao assinar token de voz para usuário {user_id}: {e}")
        raise RuntimeError(f"Falha ao gerar token de conexão LiveKit: {e}")

def get_livekit_voice_credentials(
    channel_id: int,
    user_id: int,
    user_name: str
) -> Dict[str, Any]:
    """
    Retorna as credenciais completas necessárias para o cliente React conectar-se ao SFU.
    """
    token = generate_livekit_token(channel_id, user_id, user_name)
    return {
        "livekit_url": settings.LIVEKIT_URL,
        "token": token,
        "room_name": f"channel_{channel_id}",
        "participant_identity": f"user_{user_id}",
        "participant_name": user_name,
        "is_sfu_available": bool(settings.LIVEKIT_URL and settings.LIVEKIT_API_KEY and settings.LIVEKIT_API_SECRET),
    }

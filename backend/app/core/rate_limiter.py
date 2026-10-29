import time
import asyncio
from typing import Dict, Optional, Tuple
from fastapi import HTTPException, Request, status
from app.core.config import settings
from app.core.logger import logger

class DistributedRateLimiter:
    """
    Rate Limiter distribuído com suporte primário a Redis e fallback
    automático para memória RAM local (thread-safe com janela deslizante/contador).
    """

    def __init__(self):
        # Armazenamento em memória: key -> (count, expires_at)
        self._memory_store: Dict[str, Tuple[int, float]] = {}
        self._lock = asyncio.Lock()

    def _get_redis_client(self):
        """Tenta obter o cliente Redis ativo a partir do socket_manager."""
        try:
            from app.services.socket_manager import socket_manager
            if socket_manager.is_connected_to_redis and socket_manager.redis_client:
                return socket_manager.redis_client
        except Exception:
            pass
        return None

    async def check(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
        error_detail: Optional[str] = None,
        force: bool = False
    ) -> bool:
        """
        Verifica se o limite de requisições foi atingido para uma determinada chave.
        Lança HTTPException 429 com cabeçalho Retry-After caso o limite seja excedido.
        """
        if not settings.RATELIMIT_ENABLED and not force:
            return True

        full_key = f"nexus:ratelimit:{key}"
        redis_client = self._get_redis_client()

        if redis_client:
            try:
                count = await redis_client.incr(full_key)
                if count == 1:
                    await redis_client.expire(full_key, window_seconds)
                elif count > max_requests:
                    ttl = await redis_client.ttl(full_key)
                    retry_after = max(1, ttl) if ttl > 0 else window_seconds
                    detail_msg = error_detail or f"Limite de requisições excedido ({max_requests} por {window_seconds}s). Tente novamente em {retry_after}s."
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail=detail_msg,
                        headers={"Retry-After": str(retry_after)}
                    )
                return True
            except HTTPException:
                raise
            except Exception as e:
                logger.warning(f"Falha ao validar rate limit no Redis ({e}). Utilizando fallback em memória.")

        # Fallback em memória RAM local
        now = time.time()
        async with self._lock:
            # Limpeza periódica de chaves expiradas se houver acúmulo
            if len(self._memory_store) > 2000:
                self._memory_store = {
                    k: v for k, v in self._memory_store.items() if v[1] > now
                }

            if full_key not in self._memory_store or self._memory_store[full_key][1] <= now:
                self._memory_store[full_key] = (1, now + window_seconds)
                return True

            count, expires_at = self._memory_store[full_key]
            if count >= max_requests:
                retry_after = max(1, int(expires_at - now))
                detail_msg = error_detail or f"Limite de requisições excedido ({max_requests} por {window_seconds}s). Tente novamente em {retry_after}s."
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=detail_msg,
                    headers={"Retry-After": str(retry_after)}
                )

            self._memory_store[full_key] = (count + 1, expires_at)
            return True

    def reset(self, key: Optional[str] = None):
        """Limpa as contagens em memória (útil para testes unitários)."""
        if key:
            full_key = f"nexus:ratelimit:{key}"
            self._memory_store.pop(full_key, None)
        else:
            self._memory_store.clear()

rate_limiter = DistributedRateLimiter()

def get_client_ip(request: Request) -> str:
    """Extrai o IP do cliente respeitando cabeçalhos de proxy reverso (X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"

async def check_rate_limit(
    key: str,
    max_requests: int,
    window_seconds: int,
    error_detail: Optional[str] = None,
    force: bool = False
) -> bool:
    """Função de conveniência para invocar a verificação de rate limit."""
    return await rate_limiter.check(
        key=key,
        max_requests=max_requests,
        window_seconds=window_seconds,
        error_detail=error_detail,
        force=force
    )

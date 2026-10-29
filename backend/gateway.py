"""
Gateway de WebSockets Isolado para o NexusChat (Discord Clone).
Microsserviço de tempo real de alta performance projetado para manter
dezenas de milhares de conexões persistentes WebSocket com baixo consumo de memória,
conectando-se ao cluster através do barramento Redis Pub/Sub.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.services.socket_manager import socket_manager
from app.api.v1.endpoints import discord, discord_dms, discord_unreads

@asynccontextmanager
async def gateway_lifespan(app: FastAPI):
    # Inicializa conexão com o barramento Redis Pub/Sub
    await socket_manager.init_redis()
    yield
    # Encerra conexão com o Redis
    await socket_manager.close_redis()

gateway_app = FastAPI(
    title=f"{settings.PROJECT_NAME} - Realtime Gateway",
    lifespan=gateway_lifespan
)

gateway_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registra endpoints de WebSockets e tempo real
gateway_app.include_router(discord.router, prefix=settings.API_V1_STR)
gateway_app.include_router(discord_dms.router, prefix=settings.API_V1_STR)
gateway_app.include_router(discord_unreads.router, prefix=settings.API_V1_STR)

@gateway_app.get("/health")
def gateway_health():
    return {
        "status": "ok",
        "service": "realtime-gateway",
        "redis_connected": socket_manager.is_connected_to_redis
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("gateway:gateway_app", host="0.0.0.0", port=8036, reload=False)

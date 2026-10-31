from fastapi import APIRouter
from app.api.v1.endpoints import (
    users,
    backups,
    logs,
    infrastructure,
    discord,
    discord_dms,
    discord_search,
    discord_pins,
    discord_unreads,
    discord_roles,
    discord_voice,
    discord_invites,
    discord_ws,
)

api_router = APIRouter()
api_router.include_router(users.router)
api_router.include_router(backups.router)
api_router.include_router(logs.router)
api_router.include_router(infrastructure.router)
api_router.include_router(discord.router)
api_router.include_router(discord_dms.router)
api_router.include_router(discord_search.router)
api_router.include_router(discord_pins.router)
api_router.include_router(discord_unreads.router)
api_router.include_router(discord_roles.router)
api_router.include_router(discord_voice.router)
api_router.include_router(discord_invites.router)
api_router.include_router(discord_ws.router)

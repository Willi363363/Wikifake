"""Routes HTTP et WebSocket."""

from fastapi import APIRouter

from . import routes_flags, routes_game, routes_health, routes_rooms, routes_ws

router = APIRouter()
router.include_router(routes_health.router)
router.include_router(routes_game.router)
router.include_router(routes_rooms.router)
router.include_router(routes_flags.router)
router.include_router(routes_ws.router)

__all__ = ["router"]

"""Application factory: wires the REST routers, the WebSocket route and static files."""
from fastapi import FastAPI

from src.api import flags, game, health, rooms, static_files
from src.realtime import ws


def create_app() -> FastAPI:
    app = FastAPI()

    app.include_router(health.router)
    app.include_router(game.router)
    app.include_router(flags.router)
    app.include_router(rooms.router)
    app.include_router(ws.router)

    # Last: the "/" static mount is a catch-all and must not shadow the API.
    static_files.mount_static(app)

    return app

"""WikiFake backend — FastAPI application entry point."""
from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.routes.game import router as game_router
from src.routes.flag import router as flag_router
from src.routes.multiplayer import router as multiplayer_router

load_dotenv()

app = FastAPI(title="WikiFake", description="Fake-news detection game API")

# ── Routers ──────────────────────────────────────────────────────────────
app.include_router(game_router)
app.include_router(flag_router)
app.include_router(multiplayer_router)


# ── Health check ─────────────────────────────────────────────────────────
@app.get("/ping")
def ping() -> dict[str, str]:
    return {"status": "alive"}


# ── Static files ─────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INTERFACE_DIR = os.path.join(BASE_DIR, "frontend", "dist")
PUBLIC_DIR = os.path.join(BASE_DIR, "frontend", "public")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(os.path.join(INTERFACE_DIR, "index.html"))


app.mount("/public", StaticFiles(directory=PUBLIC_DIR), name="public")
app.mount("/", StaticFiles(directory=INTERFACE_DIR), name="static")

# ── Expose rooms for test access ─────────────────────────────────────────
from src.multiplayer.room_manager import get_rooms  # noqa: E402

rooms = get_rooms()

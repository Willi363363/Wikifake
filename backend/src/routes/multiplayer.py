"""Multiplayer API routes: room creation and WebSocket endpoint."""
from __future__ import annotations

from fastapi import APIRouter, WebSocket

from ..models import CreateRoomRequest
from ..multiplayer import room_manager
from ..multiplayer.ws_handler import websocket_endpoint as _ws_handler

router = APIRouter(tags=["multiplayer"])


@router.post("/api/multiplayer/create")
def create_room(req: CreateRoomRequest | None = None) -> dict:
    """Create a new multiplayer room and return its code."""
    code = room_manager.create_room()
    return {"room_code": code}


@router.websocket("/ws/{room_code}/{player_name}")
async def ws_endpoint(websocket: WebSocket, room_code: str, player_name: str) -> None:
    """WebSocket endpoint delegating to the handler module."""
    await _ws_handler(websocket, room_code, player_name)

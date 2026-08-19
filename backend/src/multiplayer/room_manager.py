"""Room lifecycle management and broadcasting for multiplayer."""
from __future__ import annotations

import json
import logging
import random
import string
from typing import Any

from fastapi import WebSocket

from ..config import AVAILABLE_COLORS
from ..models import Player, Room

logger = logging.getLogger(__name__)

# ── In-memory store ────────────────────────────────────────
_rooms: dict[str, Room] = {}


def get_rooms() -> dict[str, Room]:
    """Return the global rooms dict (for test access)."""
    return _rooms


def create_room() -> str:
    """Create a new room and return its code."""
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    _rooms[code] = Room()
    return code


def get_room(code: str) -> Room | None:
    """Return a Room or None if not found."""
    return _rooms.get(code)


def delete_room(code: str) -> None:
    """Delete a room by code."""
    _rooms.pop(code, None)


def add_player(room: Room, name: str, websocket: WebSocket) -> None:
    """Add a player to a room, assigning a unique color."""
    if name in room.players:
        # Reconnection
        room.players[name].socket = websocket
        room.players[name].connected = True
        return

    used_colors = {p.color for p in room.players.values()}
    available = [c for c in AVAILABLE_COLORS if c not in used_colors]
    color = available[0] if available else random.choice(AVAILABLE_COLORS)

    room.players[name] = Player(socket=websocket, color=color)


def remove_player(room: Room, name: str) -> None:
    """Remove a player from a room."""
    room.players.pop(name, None)


async def broadcast(room_code: str, message: dict[str, Any]) -> None:
    """Send a JSON message to all connected players in a room."""
    room = _rooms.get(room_code)
    if room is None:
        return
    msg_str = json.dumps(message, ensure_ascii=False)
    for player in room.players.values():
        try:
            await player.socket.send_text(msg_str)
        except Exception:
            logger.debug("Failed to send to player", exc_info=True)


async def broadcast_lobby(room_code: str) -> None:
    """Broadcast lobby state (player list) to all players."""
    room = _rooms.get(room_code)
    if room is None:
        return
    players_data = [
        {
            "name": name,
            "answered": p.answered,
            "ready": p.ready,
            "color": p.color,
        }
        for name, p in room.players.items()
    ]
    await broadcast(room_code, {"type": "lobby_update", "players": players_data})


def reset_players_for_new_game(room: Room) -> None:
    """Reset all players' state for a new round."""
    for player in room.players.values():
        player.score = 0
        player.answered = False
        player.results = None
        player.ready = False
        player.items = []

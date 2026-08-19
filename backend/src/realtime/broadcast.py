"""Fan-out helpers for room-wide WebSocket messages.

Per-socket sends are wrapped in `except Exception: pass` on purpose: a dead
socket must never prevent the remaining players from receiving the message —
cleanup happens in the disconnect path, not here.
"""
import json

from .room import rooms


async def broadcast(room_code: str, message: dict) -> None:
    """Send `message` to every player in the room; ignore rooms that vanished."""
    if room_code not in rooms:
        return
    msg_str = json.dumps(message)
    for p in rooms[room_code].players.values():
        try:
            await p.socket.send_text(msg_str)
        except Exception:
            pass


async def broadcast_lobby(room_code: str) -> None:
    """Push the current lobby roster (name / answered / ready / colour) to everyone."""
    if room_code not in rooms:
        return
    room = rooms[room_code]
    players_data = [{"name": name, "answered": p.answered, "ready": p.ready, "color": p.color} for name, p in room.players.items()]
    await broadcast(room_code, {"type": "lobby_update", "players": players_data})

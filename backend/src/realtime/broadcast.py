"""Fan-out helpers for room-wide WebSocket messages.

Un socket mort ne doit jamais empêcher les autres joueurs de recevoir le
message : l'échec est donc absorbé, mais journalisé — le nettoyage vit dans
le `finally` de l'endpoint, pas ici.
"""
import json

from src.log import get_logger

from .room import rooms

log = get_logger(__name__)


async def broadcast(room_code: str, message: dict) -> None:
    """Send `message` to every player in the room; ignore rooms that vanished."""
    if room_code not in rooms:
        return
    msg_str = json.dumps(message)
    for p in rooms[room_code].players.values():
        try:
            await p.socket.send_text(msg_str)
        except Exception as exc:
            log.debug("Diffusion échouée vers un joueur de %s: %s", room_code, exc)


async def broadcast_lobby(room_code: str) -> None:
    """Push the current lobby roster (name / answered / ready / colour / host) to everyone."""
    if room_code not in rooms:
        return
    room = rooms[room_code]
    players_data = [
        {
            "name": name,
            "answered": p.answered,
            "ready": p.ready,
            "color": p.color,
            "isHost": p.is_host,
        }
        for name, p in room.players.items()
    ]
    await broadcast(room_code, {"type": "lobby_update", "players": players_data})

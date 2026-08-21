"""The /ws/{room_code}/{player_name} endpoint: accept, register, loop, disconnect."""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.log import get_logger

from .broadcast import broadcast_lobby
from .handlers import HANDLERS
from .room import (
    InvalidPlayerName,
    Player,
    assign_color,
    promote_host,
    rooms,
    validate_player_name,
)

log = get_logger(__name__)

router = APIRouter()

# Codes de fermeture WebSocket (RFC 6455).
CLOSE_POLICY_VIOLATION = 1008
CLOSE_MESSAGE_TOO_BIG = 1009

# Un message plus gros que ça n'est pas un coup de jeu : on coupe.
MAX_FRAME_CHARS = 64_000


async def _refuse(websocket: WebSocket, message: str, code: str) -> None:
    """Explique le refus avant de fermer, pour que le client sache pourquoi."""
    try:
        await websocket.send_text(json.dumps({"type": "error", "code": code, "message": message}))
    except Exception as exc:  # socket déjà parti
        log.debug("Refus non transmis: %s", exc)
    await websocket.close(code=CLOSE_POLICY_VIOLATION)


@router.websocket("/ws/{room_code}/{player_name}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_name: str) -> None:
    await websocket.accept()

    if room_code not in rooms:
        await _refuse(websocket, "Salle introuvable.", "room_not_found")
        return

    try:
        name = validate_player_name(player_name)
    except InvalidPlayerName as exc:
        await _refuse(websocket, str(exc), "invalid_name")
        return

    room = rooms[room_code]

    if name in room.players:
        existing = room.players[name]
        if existing.connected:
            # Deux joueurs sous le même pseudo : le second prendrait le
            # contrôle de la session du premier.
            await _refuse(websocket, f"Le pseudo {name!r} est déjà utilisé.", "name_taken")
            return
        # Reconnect: swap the socket in place so score/items/ready survive.
        existing.socket = websocket
        existing.connected = True
    else:
        room.players[name] = Player(socket=websocket, color=assign_color(room))

    promote_host(room)
    await broadcast_lobby(room_code)
    log.info("WS ouvert: %s/%s", room_code, name)

    try:
        while True:
            data_str = await websocket.receive_text()
            if len(data_str) > MAX_FRAME_CHARS:
                await websocket.close(code=CLOSE_MESSAGE_TOO_BIG)
                break

            try:
                data = json.loads(data_str)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error", "code": "bad_json", "message": "JSON invalide.",
                }))
                continue
            if not isinstance(data, dict):
                continue

            handler = HANDLERS.get(data.get("type"))
            if handler:
                await handler(room_code, room, name, websocket, data)

    except WebSocketDisconnect:
        log.info("WS fermé: %s/%s", room_code, name)
    except Exception:
        # Une erreur inattendue ne doit pas laisser la salle dans un état
        # incohérent : le nettoyage vit dans le `finally`.
        log.exception("WS interrompu: %s/%s", room_code, name)
    finally:
        _cleanup(room_code, name)
        if room_code in rooms:
            await broadcast_lobby(room_code)


def _cleanup(room_code: str, player_name: str) -> None:
    """Retire le joueur et oublie la salle si elle est vide.

    Auparavant dans le seul `except WebSocketDisconnect` : toute autre
    exception laissait un joueur fantôme et une salle jamais collectée, avec
    sa boucle de distribution d'items encore active.
    """
    room = rooms.get(room_code)
    if room is None:
        return

    room.players.pop(player_name, None)
    promote_host(room)

    if not room.players:
        if room.item_task and not room.item_task.done():
            room.item_task.cancel()
        del rooms[room_code]
        log.info("Salle %s oubliée (vide)", room_code)

"""Endpoint WebSocket : connexion, boucle de reception, deconnexion.

Ce fichier ne contient PLUS de logique de jeu : il valide l'entree, construit
le contexte et delegue au dispatcher.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..logging_config import get_logger
from ..rooms.service import get_room_service
from ..rooms.store import RoomError, get_room_store, validate_player_name
from ..ws import handlers  # noqa: F401 - enregistre les handlers
from ..ws.connection import get_hub
from ..ws.dispatcher import HandlerContext, dispatch
from ..ws.protocol import ServerMessage, envelope

log = get_logger(__name__)

router = APIRouter()

# Codes de fermeture WebSocket (RFC 6455 + plage applicative).
CLOSE_POLICY = 1008
CLOSE_TOO_BIG = 1009
MAX_FRAME_CHARS = 64_000


@router.websocket("/ws/{room_code}/{player_name}")
async def game_socket(websocket: WebSocket, room_code: str, player_name: str) -> None:
    store = get_room_store()
    hub = get_hub()
    service = get_room_service()

    code = room_code.upper()
    await websocket.accept()

    room = store.get(code)
    if room is None:
        await websocket.send_text(
            json.dumps(
                envelope(ServerMessage.ERROR, message="Salle introuvable.", code="room_not_found")
            )
        )
        await websocket.close(code=CLOSE_POLICY)
        return

    try:
        name = validate_player_name(player_name)
        player = store.join(room, name)
    except RoomError as exc:
        await websocket.send_text(
            json.dumps(envelope(ServerMessage.ERROR, message=str(exc), code="join_refused"))
        )
        await websocket.close(code=CLOSE_POLICY)
        return

    hub.add(code, player.name, websocket)
    await service.broadcast_lobby(room)
    log.info("WS ouvert: %s/%s", code, player.name)

    try:
        while True:
            raw = await websocket.receive_text()
            if len(raw) > MAX_FRAME_CHARS:
                await websocket.close(code=CLOSE_TOO_BIG)
                break
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await service.send_error(code, player.name, "JSON invalide.", "bad_json")
                continue
            if not isinstance(message, dict):
                continue
            ctx = HandlerContext(room=room, player=player, service=service)
            await dispatch(ctx, message)
    except WebSocketDisconnect:
        log.info("WS ferme: %s/%s", code, player.name)
    except (RuntimeError, ConnectionError) as exc:
        log.info("WS interrompu %s/%s: %s", code, player.name, exc)
    finally:
        hub.remove(code, player.name)
        store.leave(room, player.name)
        if room.is_empty:
            service.cancel_tasks(code)
            hub.drop_room(code)
        else:
            await service.broadcast_lobby(room)

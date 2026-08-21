"""Registre des sockets ouverts et diffusion des messages.

Isole le transport du metier : les handlers et le `RoomService` ne
manipulent jamais un `WebSocket` directement, ils passent par le hub.
Les sockets morts sont detectes et retires (plus de `except: pass` muet).
"""

from __future__ import annotations

import json
from collections.abc import Iterable

from fastapi import WebSocket

from ..logging_config import get_logger

log = get_logger(__name__)


class ConnectionHub:
    """`{code_salle: {pseudo: websocket}}`."""

    def __init__(self) -> None:
        self._sockets: dict[str, dict[str, WebSocket]] = {}

    # --- enregistrement ---------------------------------------------------
    def add(self, room_code: str, player_name: str, socket: WebSocket) -> None:
        self._sockets.setdefault(room_code, {})[player_name] = socket

    def remove(self, room_code: str, player_name: str) -> None:
        sockets = self._sockets.get(room_code)
        if not sockets:
            return
        sockets.pop(player_name, None)
        if not sockets:
            self._sockets.pop(room_code, None)

    def drop_room(self, room_code: str) -> None:
        self._sockets.pop(room_code, None)

    def names(self, room_code: str) -> list[str]:
        return list(self._sockets.get(room_code, {}))

    # --- envoi ------------------------------------------------------------
    async def send(self, room_code: str, player_name: str, message: dict) -> bool:
        """Envoie a un joueur. Retourne False si le socket est mort."""
        socket = self._sockets.get(room_code, {}).get(player_name)
        if socket is None:
            return False
        try:
            await socket.send_text(json.dumps(message, ensure_ascii=False))
            return True
        except (RuntimeError, ConnectionError, OSError) as exc:
            log.debug("Socket %s/%s injoignable: %s", room_code, player_name, exc)
            self.remove(room_code, player_name)
            return False

    async def broadcast(
        self,
        room_code: str,
        message: dict,
        exclude: Iterable[str] = (),
    ) -> None:
        """Diffuse a toute la salle (hors `exclude`)."""
        excluded = set(exclude)
        for name in list(self._sockets.get(room_code, {})):
            if name in excluded:
                continue
            await self.send(room_code, name, message)


_hub: ConnectionHub | None = None


def get_hub() -> ConnectionHub:
    global _hub
    if _hub is None:
        _hub = ConnectionHub()
    return _hub

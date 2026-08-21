"""Diffusion des messages d'une salle.

Fine couche au-dessus du hub WebSocket : les autres modules n'ecrivent
jamais un nom de message en dur ni ne touchent a un socket.

Les parametres avant `/` sont positionnels uniquement : la charge utile
peut ainsi contenir des cles nommees `room` ou `player` sans collision.
"""

from __future__ import annotations

from ..ws.connection import ConnectionHub
from ..ws.protocol import ServerMessage, envelope
from .models import Player, Room
from .scoring import provisional_score


class RoomBroadcaster:
    def __init__(self, hub: ConnectionHub) -> None:
        self.hub = hub

    async def to_room(self, room: Room, kind: ServerMessage, /, **payload) -> None:
        await self.hub.broadcast(room.code, envelope(kind, **payload))

    async def to_room_except(
        self, room: Room, exclude: str, kind: ServerMessage, /, **payload
    ) -> None:
        await self.hub.broadcast(room.code, envelope(kind, **payload), exclude=[exclude])

    async def to_player(
        self, room: Room, player: Player, kind: ServerMessage, /, **payload
    ) -> None:
        await self.hub.send(room.code, player.name, envelope(kind, **payload))

    async def lobby(self, room: Room) -> None:
        await self.to_room(room, ServerMessage.LOBBY_UPDATE, room=room.to_lobby_dict())

    async def error(self, room: Room, player: Player, message: str, code: str = "generic") -> None:
        await self.to_player(room, player, ServerMessage.ERROR, message=message, code=code)

    async def room_error(self, room: Room, message: str, code: str = "generic") -> None:
        await self.to_room(room, ServerMessage.ERROR, message=message, code=code)

    async def live_score(self, room: Room, player: Player) -> None:
        """Score provisoire, calcule par le serveur (jamais par le client)."""
        score = provisional_score(len(player.selection), player.hints_used, player.stolen_points)
        await self.to_room(room, ServerMessage.LIVE_SCORE, player=player.name, score=score)

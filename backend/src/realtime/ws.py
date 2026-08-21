"""The /ws/{room_code}/{player_name} endpoint: accept, register, loop, disconnect."""
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .broadcast import broadcast_lobby
from .handlers import HANDLERS
from .room import Player, assign_color, promote_host, rooms

router = APIRouter()


@router.websocket("/ws/{room_code}/{player_name}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_name: str) -> None:
    await websocket.accept()
    if room_code not in rooms:
        await websocket.close(code=1008)
        return

    room = rooms[room_code]

    if player_name in room.players:
        # Reconnect: swap the socket in place so score/items/ready survive.
        room.players[player_name].socket = websocket
        room.players[player_name].connected = True
    else:
        room.players[player_name] = Player(socket=websocket, color=assign_color(room))

    promote_host(room)
    await broadcast_lobby(room_code)

    try:
        while True:
            data_str = await websocket.receive_text()
            data = json.loads(data_str)

            handler = HANDLERS.get(data["type"])
            if handler:
                await handler(room_code, room, player_name, websocket, data)

    except WebSocketDisconnect:
        if player_name in room.players:
            del room.players[player_name]
            # Si l'hôte vient de partir, un autre joueur reprend le rôle.
            promote_host(room)
            await broadcast_lobby(room_code)
        if not room.players:
            # Last player left: stop the item loop and forget the room.
            if room.item_task and not room.item_task.done():
                room.item_task.cancel()
            del rooms[room_code]

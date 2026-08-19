"""WebSocket endpoint and message dispatch for multiplayer rooms."""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from ..core.scoring import compute_score
from . import room_manager
from .theme_service import pick_and_start, start_game_direct, start_theme_voting

logger = logging.getLogger(__name__)


async def websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    player_name: str,
) -> None:
    """Main WebSocket handler for a multiplayer room."""
    await websocket.accept()

    room = room_manager.get_room(room_code)
    if room is None:
        await websocket.close(code=1008)
        return

    room_manager.add_player(room, player_name, websocket)
    await room_manager.broadcast_lobby(room_code)

    try:
        while True:
            raw = await websocket.receive_text()
            data: dict[str, Any] = json.loads(raw)
            msg_type = data.get("type", "")

            await _dispatch(websocket, room_code, player_name, msg_type, data)
    except WebSocketDisconnect:
        await _handle_disconnect(room_code, player_name)


async def _dispatch(
    websocket: WebSocket,
    room_code: str,
    player_name: str,
    msg_type: str,
    data: dict[str, Any],
) -> None:
    """Route an incoming WS message to its handler."""
    room = room_manager.get_room(room_code)
    if room is None:
        return

    if msg_type == "set_ready":
        await _handle_set_ready(room_code, player_name, data)

    elif msg_type == "get_lobby":
        await room_manager.broadcast_lobby(room_code)

    elif msg_type == "force_start" and room.state == "waiting":
        if "with_items" in data:
            room.with_items = data["with_items"]
        if "time_limit" in data:
            room.time_limit = int(data["time_limit"])
        await start_theme_voting(room_code)

    elif msg_type == "submit_theme" and room.state == "theme_voting":
        await _handle_submit_theme(room_code, player_name, data)

    elif msg_type == "force_pick" and room.state == "theme_voting":
        if room.voting_themes:
            await pick_and_start(room_code)
        else:
            await websocket.send_text(
                json.dumps({"type": "error", "message": "Personne n'a encore proposé de thème."})
            )

    elif msg_type == "start_game" and room.state == "waiting":
        await _handle_start_game(websocket, room_code, data)

    elif msg_type == "live_score" and room.state == "playing":
        await room_manager.broadcast(room_code, {
            "type": "live_score_update",
            "player": player_name,
            "score": data.get("score", 0),
        })

    elif msg_type == "cursor" and room.state == "playing":
        await _handle_cursor(room_code, player_name, data)

    elif msg_type == "chat_message":
        await room_manager.broadcast(room_code, {
            "type": "chat_message",
            "sender": player_name,
            "content": data.get("content", ""),
        })

    elif msg_type == "use_item" and room.state == "playing":
        await _handle_use_item(room_code, player_name, data)

    elif msg_type == "unsubmit_answer" and room.state == "playing":
        room.players[player_name].answered = False
        await room_manager.broadcast_lobby(room_code)

    elif msg_type == "submit_answer" and room.state == "playing":
        await _handle_submit_answer(room_code, player_name, data)


# ── Individual message handlers ──────────────────────────────────────────


async def _handle_set_ready(
    room_code: str, player_name: str, data: dict[str, Any]
) -> None:
    room = room_manager.get_room(room_code)
    if room is None:
        return
    room.players[player_name].ready = data.get("ready", True)
    if "with_items" in data:
        room.with_items = data["with_items"]
    if "time_limit" in data:
        room.time_limit = int(data["time_limit"])
    await room_manager.broadcast_lobby(room_code)


async def _handle_submit_theme(
    room_code: str, player_name: str, data: dict[str, Any]
) -> None:
    room = room_manager.get_room(room_code)
    if room is None:
        return
    theme = data.get("theme", "").strip()
    if not theme:
        return

    room.voting_themes[player_name] = theme
    connected_players = [
        n for n, p in room.players.items() if p.connected
    ]
    submitted = list(room.voting_themes.keys())

    await room_manager.broadcast(room_code, {
        "type": "theme_vote_update",
        "submitted": submitted,
        "total": len(connected_players),
    })

    # If everyone voted, pick a random theme and start
    if all(n in room.voting_themes for n in connected_players):
        await pick_and_start(room_code)


async def _handle_start_game(
    websocket: WebSocket, room_code: str, data: dict[str, Any]
) -> None:
    category = data.get("category", "")
    with_items = data.get("with_items", True)
    time_limit = int(data.get("time_limit", 300))

    success = await start_game_direct(room_code, category, with_items, time_limit)
    if not success:
        await websocket.send_text(
            json.dumps({"type": "error", "message": "Mot-clé introuvable."})
        )


async def _handle_cursor(
    room_code: str, player_name: str, data: dict[str, Any]
) -> None:
    room = room_manager.get_room(room_code)
    if room is None:
        return
    msg_str = json.dumps({
        "type": "cursor_update",
        "player": player_name,
        "x": data.get("x", 0),
        "y": data.get("y", 0),
    })
    for name, player in room.players.items():
        if name != player_name:
            try:
                await player.socket.send_text(msg_str)
            except Exception:
                logger.debug("Failed to send cursor to %s", name, exc_info=True)


async def _handle_use_item(
    room_code: str, player_name: str, data: dict[str, Any]
) -> None:
    room = room_manager.get_room(room_code)
    if room is None:
        return

    instance_id = data.get("instance_id")
    targets: list[str] = data.get("targets", [])
    player_items = room.players[player_name].items

    item_used: dict[str, Any] | None = None
    for i, it in enumerate(player_items):
        if it["instance_id"] == instance_id:
            item_used = player_items.pop(i)
            break

    if item_used is None:
        return

    for target in targets:
        if target in room.players:
            try:
                await room.players[target].socket.send_text(
                    json.dumps({
                        "type": "item_effect",
                        "item_id": item_used["id"],
                        "item_name": item_used["name"],
                        "item_icon": item_used["icon"],
                        "from": player_name,
                    })
                )
            except Exception:
                logger.debug("Failed to send item effect to %s", target, exc_info=True)

    await room_manager.broadcast(room_code, {
        "type": "item_used",
        "player": player_name,
        "item_id": item_used["id"],
        "item_name": item_used["name"],
        "item_icon": item_used["icon"],
        "targets": targets,
    })


async def _handle_submit_answer(
    room_code: str, player_name: str, data: dict[str, Any]
) -> None:
    room = room_manager.get_room(room_code)
    if room is None or room.game_data is None:
        return

    indices = data.get("answers", [])
    hints_used = data.get("hintsUsed", 0)
    hint_penalty = data.get("hintPenalty", 0)
    score_stolen = data.get("scoreStolen", 0)
    time_taken = time.time() - room.start_time

    breakdown, _result = compute_score(
        selected_indices=indices,
        correct_positions=room.game_data["positions"],
        time_taken=time_taken,
        time_limit=room.time_limit,
        hints_used=hints_used,
        hint_penalty=hint_penalty,
        score_stolen=score_stolen,
    )

    player = room.players[player_name]
    player.answered = True
    player.score = breakdown.total
    player.results = {
        "tp": breakdown.tp,
        "fp": breakdown.fp,
        "timeBonus": breakdown.time_bonus,
        "hintsUsed": breakdown.hints_used,
        "hintPenalty": breakdown.hint_penalty,
    }

    all_answered = all(p.answered for p in room.players.values())
    if all_answered:
        if room.picking_theme:
            return

        if room.item_task is not None and not room.item_task.done():
            room.item_task.cancel()

        final_leaderboard = [
            {
                "id": name,
                "name": name,
                "score": p.score,
                "color": p.color,
                "breakdown": p.results,
            }
            for name, p in room.players.items()
        ]
        final_leaderboard.sort(key=lambda x: int(x["score"]), reverse=True)  # type: ignore[arg-type]

        room.state = "waiting"
        for p in room.players.values():
            p.ready = False
        await room_manager.broadcast(room_code, {
            "type": "game_end",
            "leaderboard": final_leaderboard,
        })
    else:
        await room_manager.broadcast_lobby(room_code)


async def _handle_disconnect(room_code: str, player_name: str) -> None:
    """Handle a WebSocket disconnection."""
    room = room_manager.get_room(room_code)
    if room is None:
        return

    room_manager.remove_player(room, player_name)
    await room_manager.broadcast_lobby(room_code)

    if not room.players:
        if room.item_task is not None and not room.item_task.done():
            room.item_task.cancel()
        room_manager.delete_room(room_code)

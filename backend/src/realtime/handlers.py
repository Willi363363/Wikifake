"""One handler per incoming WebSocket message type, plus the dispatch table.

Each handler owns its own state guard (e.g. only act while "playing") because
in the old monolith those guards were part of the `elif` chain: a message that
arrives in the wrong state is silently ignored, never an error. Handlers share
a uniform signature so `HANDLERS` can stay a flat dict.
"""
import asyncio
import json
import time
from typing import Awaitable, Callable

from fastapi import WebSocket

from src.core.verification import check_answer
from src.game import generate_game

from .broadcast import broadcast, broadcast_lobby
from .items import item_distribution_loop
from .room import GAME_DURATION, Room, is_host
from .scoring import build_leaderboard, compute_score
from .themes import pick_and_start, start_theme_voting

Handler = Callable[[str, Room, str, WebSocket, dict], Awaitable[None]]


async def _reject_if_not_host(room: Room, player_name: str, websocket: WebSocket) -> bool:
    """Refuse une commande réservée à l'hôte. Retourne True si elle est refusée.

    Le rôle vient de l'état serveur (`Player.is_host`) : auparavant `isHost`
    n'existait que côté client, n'importe qui pouvait donc lancer la partie,
    couper le vote ou changer la durée.
    """
    if is_host(room, player_name):
        return False
    await websocket.send_text(json.dumps({
        "type": "error",
        "code": "not_host",
        "message": "Seul l'hôte peut faire cela.",
    }))
    return True


async def handle_set_ready(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    room.players[player_name].ready = data.get("ready", True)
    # Les options de partie appartiennent à l'hôte : un invité qui les envoie
    # (le client les joint à chaque `set_ready`) ne doit pas pouvoir les changer.
    if is_host(room, player_name):
        if "with_items" in data:
            room.with_items = data["with_items"]
        if "time_limit" in data:
            room.time_limit = int(data["time_limit"])
    await broadcast_lobby(room_code)


async def handle_get_lobby(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    await broadcast_lobby(room_code)


async def handle_force_start(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    if room.state != "waiting":
        return
    if await _reject_if_not_host(room, player_name, websocket):
        return
    if "with_items" in data:
        room.with_items = data["with_items"]
    if "time_limit" in data:
        room.time_limit = int(data["time_limit"])
    await start_theme_voting(room_code)


async def handle_submit_theme(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    if room.state != "theme_voting":
        return
    theme = data.get("theme", "").strip()
    if theme:
        room.voting_themes[player_name] = theme
        connected_players = [n for n, p in room.players.items() if p.connected]
        submitted = list(room.voting_themes.keys())
        await broadcast(room_code, {
            "type": "theme_vote_update",
            "submitted": submitted,
            "total": len(connected_players)
        })
        # If everyone voted, pick a random theme and start
        if all(n in room.voting_themes for n in connected_players):
            await pick_and_start(room_code)


async def handle_force_pick(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    if room.state != "theme_voting":
        return
    if await _reject_if_not_host(room, player_name, websocket):
        return
    if room.voting_themes:
        await pick_and_start(room_code)
    else:
        await websocket.send_text(json.dumps({"type": "error", "message": "Personne n'a encore proposé de thème."}))


async def handle_start_game(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    """Direct start with a chosen category (no theme voting)."""
    if room.state != "waiting":
        return
    if await _reject_if_not_host(room, player_name, websocket):
        return
    category = data.get("category")
    with_items = data.get("with_items", True)
    time_limit = int(data.get("time_limit", GAME_DURATION))
    room.with_items = with_items
    room.time_limit = time_limit

    game_data = generate_game(category)
    if not game_data:
        await websocket.send_text(json.dumps({"type": "error", "message": "Mot-clé introuvable."}))
        return

    room.game_data = game_data
    room.state = "playing"
    room.start_time = time.time()

    for p in room.players.values():
        p.score = 0
        p.answered = False
        p.results = None
        p.items = []

    if room.item_task and not room.item_task.done():
        room.item_task.cancel()
    if with_items:
        room.item_task = asyncio.create_task(item_distribution_loop(room_code))

    await broadcast(room_code, {
        "type": "game_start",
        "data": {
            "topic": game_data["topic"],
            "paragraphs": game_data["paragraphs"],
            "misinformations": game_data["misinformations"],
            "positions": game_data["positions"],
            "total_fakes": game_data["total_false_statements"],
            "wikipedia_url": game_data.get("wikipedia_url", ""),
            "players": list(room.players.keys()),
            "with_items": with_items,
            "time_limit": time_limit,
        }
    })


async def handle_live_score(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    if room.state != "playing":
        return
    await broadcast(room_code, {
        "type": "live_score_update",
        "player": player_name,
        "score": data.get("score", 0)
    })


async def handle_cursor(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    """Relay the cursor position to every OTHER player (the sender knows its own)."""
    if room.state != "playing":
        return
    msg_str = json.dumps({
        "type": "cursor_update",
        "player": player_name,
        "x": data.get("x", 0),
        "y": data.get("y", 0)
    })
    for name, p in room.players.items():
        if name != player_name:
            try:
                await p.socket.send_text(msg_str)
            except Exception:
                pass


async def handle_chat_message(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    # Broadcast chat to all players in the room (including sender)
    await broadcast(room_code, {
        "type": "chat_message",
        "sender": player_name,
        "content": data.get("content", ""),
    })


async def handle_use_item(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    if room.state != "playing":
        return
    instance_id = data.get("instance_id")
    targets = data.get("targets", [])
    player_items = room.players[player_name].items
    item_used = None
    for i, it in enumerate(player_items):
        if it["instance_id"] == instance_id:
            item_used = player_items.pop(i)
            break
    if item_used:
        for target in targets:
            if target in room.players:
                try:
                    await room.players[target].socket.send_text(json.dumps({
                        "type": "item_effect",
                        "item_id": item_used["id"],
                        "item_name": item_used["name"],
                        "item_icon": item_used["icon"],
                        "from": player_name,
                    }))
                except Exception:
                    pass
        await broadcast(room_code, {
            "type": "item_used",
            "player": player_name,
            "item_id": item_used["id"],
            "item_name": item_used["name"],
            "item_icon": item_used["icon"],
            "targets": targets,
        })


async def handle_unsubmit_answer(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    if room.state != "playing":
        return
    room.players[player_name].answered = False
    await broadcast_lobby(room_code)


async def handle_submit_answer(room_code: str, room: Room, player_name: str, websocket: WebSocket, data: dict) -> None:
    if room.state != "playing":
        return
    indices = data.get("answers", [])
    hints_used = data.get("hintsUsed", 0)
    hint_penalty = data.get("hintPenalty", 0)
    score_stolen = data.get("scoreStolen", 0)
    time_taken = time.time() - room.start_time

    result = check_answer(indices, room.game_data["positions"])
    tp = len(result["correct_found"])
    fp = len(result["false_positives"])

    score, time_bonus = compute_score(tp, fp, hint_penalty, score_stolen, room.time_limit, time_taken)

    player = room.players[player_name]
    player.answered = True
    player.score = score
    player.results = {
        "tp": tp,
        "fp": fp,
        "timeBonus": time_bonus,
        "hintsUsed": hints_used,
        "hintPenalty": hint_penalty
    }

    all_answered = all(p.answered for p in room.players.values())
    if all_answered:
        # A theme pick already in flight will restart the round itself.
        if room.picking_theme:
            return

        if room.item_task and not room.item_task.done():
            room.item_task.cancel()

        final_leaderboard = build_leaderboard(room)

        room.state = "waiting"
        for p in room.players.values():
            p.ready = False
        await broadcast(room_code, {"type": "game_end", "leaderboard": final_leaderboard})
    else:
        await broadcast_lobby(room_code)


HANDLERS: dict[str, Handler] = {
    "set_ready": handle_set_ready,
    "get_lobby": handle_get_lobby,
    "force_start": handle_force_start,
    "submit_theme": handle_submit_theme,
    "force_pick": handle_force_pick,
    "start_game": handle_start_game,
    "live_score": handle_live_score,
    "cursor": handle_cursor,
    "chat_message": handle_chat_message,
    "use_item": handle_use_item,
    "unsubmit_answer": handle_unsubmit_answer,
    "submit_answer": handle_submit_answer,
}

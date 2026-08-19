"""Theme voting and game-start orchestration for multiplayer."""
from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any

from ..config import FALLBACK_THEMES, GAME_DURATION
from ..core.agent import FakeNewsGame
from . import room_manager
from .item_service import item_distribution_loop

logger = logging.getLogger(__name__)

# Module-level game instance (shared, stateless between calls)
_game = FakeNewsGame()


async def start_theme_voting(room_code: str) -> None:
    """Transition a room into the theme_voting state."""
    room = room_manager.get_room(room_code)
    if room is None or room.state == "theme_voting":
        return
    room.state = "theme_voting"
    room.voting_themes = {}
    await room_manager.broadcast(room_code, {"type": "theme_vote_start"})


async def pick_and_start(room_code: str, use_votes: bool = True) -> None:
    """Pick a theme from votes (or fallbacks) and start the game."""
    room = room_manager.get_room(room_code)
    if room is None or room.picking_theme:
        return
    room.picking_theme = True

    try:
        if use_votes:
            themes = list(room.voting_themes.values())
            available_themes = list(set(themes))
            random.shuffle(available_themes)
            all_candidates = available_themes + FALLBACK_THEMES
            first_candidate = all_candidates[0] if all_candidates else "Général"
            proposers = [
                n for n, t in room.voting_themes.items() if t == first_candidate
            ]
            proposer_name = proposers[0] if proposers else "Système"
            all_themes_dict = dict(room.voting_themes)
        else:
            all_candidates = list(FALLBACK_THEMES)
            first_candidate = all_candidates[0] if all_candidates else "Général"
            proposer_name = "Système"
            all_themes_dict = {}

        # Broadcast the candidate theme immediately
        await room_manager.broadcast(room_code, {
            "type": "theme_selected",
            "theme": first_candidate,
            "proposer": proposer_name,
            "all_themes": all_themes_dict,
            "loading": True,
        })

        # Generate game data in a background thread
        def _generate_game() -> tuple[str | None, str | None, dict[str, Any] | None]:
            for theme in all_candidates:
                data = _game.start_game(theme)
                if data:
                    if use_votes:
                        p_list = [
                            n for n, t in room.voting_themes.items() if t == theme
                        ]
                        proposer = p_list[0] if p_list else "Système"
                    else:
                        proposer = "Système"
                    return theme, proposer, data
            return None, None, None

        _chosen, _proposer, game_data = await asyncio.to_thread(_generate_game)

        if not game_data:
            await room_manager.broadcast(room_code, {
                "type": "error",
                "message": "Erreur critique : Impossible de charger un sujet Wikipédia.",
            })
            room.state = "waiting"
            room.between_rounds = False
            await room_manager.broadcast_lobby(room_code)
            return

        await _start_game_in_room(room_code, game_data)
    finally:
        room.picking_theme = False


async def start_game_direct(
    room_code: str,
    category: str,
    with_items: bool = True,
    time_limit: int = GAME_DURATION,
) -> bool:
    """Start a game directly with a given category (no theme voting)."""
    room = room_manager.get_room(room_code)
    if room is None:
        return False

    room.with_items = with_items
    room.time_limit = time_limit

    game_data = _game.start_game(category)
    if not game_data:
        return False

    await _start_game_in_room(room_code, game_data)
    return True


async def _start_game_in_room(
    room_code: str,
    game_data: dict[str, Any],
) -> None:
    """Set up and broadcast a game start."""
    room = room_manager.get_room(room_code)
    if room is None:
        return

    room.game_data = game_data
    room.state = "playing"
    room.start_time = time.time()

    room_manager.reset_players_for_new_game(room)

    # Cancel previous item task if running
    if room.item_task is not None and not room.item_task.done():
        room.item_task.cancel()
    if room.with_items:
        room.item_task = asyncio.create_task(item_distribution_loop(room_code))

    payload = {
        "type": "game_start",
        "data": {
            "topic": game_data["topic"],
            "paragraphs": game_data.get("paragraphs", []),
            "misinformations": game_data.get("misinformations", []),
            "positions": game_data.get("positions", []),
            "total_fakes": game_data.get("total_false_statements", 0),
            "wikipedia_url": game_data.get("wikipedia_url", ""),
            "players": [
                {"name": n, "color": p.color}
                for n, p in room.players.items()
            ],
            "with_items": room.with_items,
            "time_limit": room.time_limit,
        },
    }
    await room_manager.broadcast(room_code, payload)

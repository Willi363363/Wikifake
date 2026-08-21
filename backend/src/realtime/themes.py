"""Theme voting and round start-up for multiplayer rooms."""
import asyncio
import random
import time

from src.game import generate_game

from .broadcast import broadcast, broadcast_lobby
from .items import item_distribution_loop
from .room import rooms


async def start_theme_voting(room_code: str) -> None:
    """Switch the room to theme voting (idempotent) and notify players."""
    room = rooms[room_code]
    if room.state == "theme_voting":
        return
    room.state = "theme_voting"
    room.voting_themes = {}
    await broadcast(room_code, {"type": "theme_vote_start"})


async def pick_and_start(room_code: str, use_votes: bool = True) -> None:
    """Pick a theme (from votes or fallbacks) and launch the round.

    Two-step on purpose: `theme_selected` goes out with `loading: True` FIRST
    so the frontend shows its waiting screen right away, then the (slow)
    Wikipedia + LLM generation runs in a worker thread via `asyncio.to_thread`
    so the event loop keeps servicing the sockets. `picking_theme` guards
    against a second concurrent pick (e.g. force_pick racing the last vote).
    """
    room = rooms[room_code]
    if room.picking_theme:
        return
    room.picking_theme = True
    fallback_themes = ["Paris", "Chat", "Chocolat", "Football", "Soleil", "Lune", "Château", "Pizza", "Japon", "Cinéma"]

    if use_votes:
        themes = list(room.voting_themes.values())
        available_themes = list(set(themes))
        random.shuffle(available_themes)
        all_candidates = available_themes + fallback_themes
        first_candidate = all_candidates[0] if all_candidates else "Général"
        proposers = [n for n, t in room.voting_themes.items() if t == first_candidate]
        proposer_name = proposers[0] if proposers else "Système"
        all_themes_dict = room.voting_themes
    else:
        all_candidates = fallback_themes
        first_candidate = all_candidates[0] if all_candidates else "Général"
        proposer_name = "Système"
        all_themes_dict = {}

    # Step 1: immediately pick a candidate theme and broadcast it
    await broadcast(room_code, {
        "type": "theme_selected",
        "theme": first_candidate,
        "proposer": proposer_name,
        "all_themes": all_themes_dict,
        "loading": True  # signal the frontend to show the waiting screen immediately
    })

    # Step 2: generate the game data in a background thread so WebSocket stays alive
    def first_playable_theme():
        for theme in all_candidates:
            data = generate_game(theme)
            if data:
                if use_votes:
                    p_list = [n for n, t in room.voting_themes.items() if t == theme]
                    p = p_list[0] if p_list else "Système"
                else:
                    p = "Système"
                return theme, p, data
        return None, None, None

    chosen, proposer, game_data = await asyncio.to_thread(first_playable_theme)

    if not game_data:
        room.picking_theme = False
        await broadcast(room_code, {"type": "error", "message": "Erreur critique : Impossible de charger un sujet Wikipédia."})
        room.state = "waiting"
        room.between_rounds = False
        await broadcast_lobby(room_code)
        return

    try:
        await start_game_in_room(room_code, chosen, preloaded_game_data=game_data)
    finally:
        room.picking_theme = False


async def start_game_in_room(room_code: str, category: str, preloaded_game_data: dict | None = None) -> bool:
    """Reset player round state, (re)arm the item loop, and broadcast game_start."""
    room = rooms[room_code]
    game_data = preloaded_game_data or generate_game(category)
    if not game_data:
        return False

    room.game_data = game_data
    room.state = "playing"
    room.start_time = time.time()

    for p in room.players.values():
        p.score = 0
        p.answered = False
        p.results = None
        p.ready = False
        p.items = []

    if room.item_task and not room.item_task.done():
        room.item_task.cancel()
    if room.with_items:
        room.item_task = asyncio.create_task(item_distribution_loop(room_code))

    payload = {
        "type": "game_start",
        "data": {
            "topic": game_data["topic"],
            "paragraphs": game_data["paragraphs"],
            # Ni `positions` ni `misinformations` : la solution reste au
            # serveur jusqu'à `game_end`. Le client ne peut donc plus la lire
            # dans le DevTools ni s'en servir pour ses indices.
            "total_fakes": game_data["total_false_statements"],
            "wikipedia_url": game_data.get("wikipedia_url", ""),
            "players": [{"name": n, "color": p.color} for n, p in room.players.items()],
            "with_items": room.with_items,
            "time_limit": room.time_limit,
        }
    }
    await broadcast(room_code, payload)
    return True

"""Periodic item distribution for multiplayer games."""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Any

from ..config import ITEM_INTERVAL_SECONDS, ITEMS, MAX_ITEM_ROUNDS
from . import room_manager

logger = logging.getLogger(__name__)


async def item_distribution_loop(room_code: str) -> None:
    """Distribute one random item to each player every ITEM_INTERVAL_SECONDS (up to MAX_ITEM_ROUNDS)."""
    try:
        for round_num in range(1, MAX_ITEM_ROUNDS + 1):
            await asyncio.sleep(ITEM_INTERVAL_SECONDS)

            room = room_manager.get_room(room_code)
            if room is None or room.state != "playing":
                break

            distribution: dict[str, dict[str, Any]] = {}
            for player_name in list(room.players.keys()):
                item = random.choice(ITEMS)
                instance = {
                    **item,
                    "instance_id": f"{player_name}_{round_num}_{item['id']}",
                }
                room.players[player_name].items.append(instance)
                distribution[player_name] = instance

            await room_manager.broadcast(room_code, {
                "type": "items_distributed",
                "minute": round_num,
                "items": distribution,
            })
    except asyncio.CancelledError:
        logger.debug("Item distribution cancelled for room %s", room_code)

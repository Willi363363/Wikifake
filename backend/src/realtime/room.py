"""Room and player state for the multiplayer mode.

The `rooms` registry stays a plain dict so callers (and the test-suite) can
keep using `.clear()`, `.get()` and `in` on it; only the *values* moved from
ad-hoc dicts to dataclasses so every field has one obvious home and default.
"""
import asyncio
import random
import time
from dataclasses import dataclass, field
from typing import Optional

from fastapi import WebSocket

GAME_DURATION = 300  # 5 minutes — default round length; a room's time_limit overrides it

AVAILABLE_COLORS = ["#e63946", "#f4a261", "#2a9d8f", "#264653", "#8338ec", "#ff006e", "#3a0ca3", "#fb5607"]


@dataclass
class Player:
    """One connected participant. `socket` is replaced in place on reconnect."""
    socket: WebSocket
    color: str
    score: int = 0
    answered: bool = False
    results: Optional[dict] = None
    ready: bool = False
    connected: bool = True
    items: list[dict] = field(default_factory=list)
    # Rôle d'hôte : décidé et vérifié par le serveur. Le client se contentait
    # auparavant de le déduire tout seul, si bien que n'importe quel joueur
    # pouvait lancer la partie ou couper le vote.
    is_host: bool = False
    joined_at: float = field(default_factory=time.time)


@dataclass
class Room:
    """One multiplayer room, keyed by its 6-char code in `rooms`."""
    players: dict[str, Player] = field(default_factory=dict)
    game_data: Optional[dict] = None
    state: str = "waiting"  # waiting | theme_voting | playing
    start_time: float = 0
    item_task: Optional[asyncio.Task] = None
    time_limit: int = GAME_DURATION
    voting_themes: dict[str, str] = field(default_factory=dict)
    picking_theme: bool = False  # guards against concurrent pick_and_start runs
    with_items: bool = True
    between_rounds: bool = False


# Global registry: room code -> Room. Kept a plain dict on purpose (see module docstring).
rooms: dict[str, Room] = {}


def assign_color(room: Room) -> str:
    """First unused colour, else a random one — keeps small lobbies collision-free."""
    used_colors = [p.color for p in room.players.values()]
    available = [c for c in AVAILABLE_COLORS if c not in used_colors]
    return available[0] if available else random.choice(AVAILABLE_COLORS)


def promote_host(room: Room) -> Optional[Player]:
    """Garantit qu'exactement un joueur connecté porte le rôle d'hôte.

    Appelé à chaque arrivée et à chaque départ : si l'hôte se déconnecte, le
    plus ancien joueur encore connecté prend le relais.
    """
    current = next((p for p in room.players.values() if p.is_host), None)
    if current is not None and current.connected:
        return current
    if current is not None:
        current.is_host = False

    candidates = sorted(
        (p for p in room.players.values() if p.connected),
        key=lambda p: p.joined_at,
    )
    if not candidates:
        return None
    candidates[0].is_host = True
    return candidates[0]


def is_host(room: Room, player_name: str) -> bool:
    player = room.players.get(player_name)
    return bool(player and player.is_host)

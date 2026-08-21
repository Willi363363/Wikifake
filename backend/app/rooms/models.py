"""Modeles de salle et de joueur.

Remplace les `dict` de `dict` de l'ancien `main.py`, ou les cles etaient
creees a la volee et lues avec des `.get(..., defaut)` un peu partout.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from ..game.models import GameData


class RoomState(str, Enum):
    """Machine a etats explicite d'une salle."""

    WAITING = "waiting"
    THEME_VOTING = "theme_voting"
    GENERATING = "generating"
    PLAYING = "playing"
    FINISHED = "finished"


@dataclass
class ItemInstance:
    """Un item possede par un joueur (une occurrence, pas une definition)."""

    instance_id: str
    item_id: str

    def to_dict(self) -> dict:
        return {"instance_id": self.instance_id, "item_id": self.item_id}


@dataclass
class Player:
    """Un joueur. Le socket est volontairement separe des donnees metier
    pour que la salle reste serialisable et testable sans WebSocket."""

    name: str
    color: str
    connected: bool = True
    is_host: bool = False
    ready: bool = False
    answered: bool = False
    score: int = 0
    breakdown: dict[str, Any] | None = None
    selection: list[int] = field(default_factory=list)
    items: list[ItemInstance] = field(default_factory=list)
    # Etat suivi cote serveur => le score n'est plus falsifiable par le client.
    hints_used: int = 0
    stolen_points: int = 0
    time_malus_s: int = 0
    hint_locked_until: float = 0.0
    revealed_indices: list[int] = field(default_factory=list)
    # {index_de_cible: niveau} — niveau 1 = indice, niveau 2 = localisation
    hint_levels: dict[int, int] = field(default_factory=dict)
    last_cursor_at: float = 0.0
    joined_at: float = field(default_factory=time.time)

    @property
    def hints_locked(self) -> bool:
        return time.time() < self.hint_locked_until

    def lock_hints_for(self, seconds: float) -> None:
        self.hint_locked_until = time.time() + seconds

    def reset_for_new_game(self) -> None:
        self.ready = False
        self.answered = False
        self.score = 0
        self.breakdown = None
        self.selection = []
        self.items = []
        self.hints_used = 0
        self.stolen_points = 0
        self.time_malus_s = 0
        self.hint_locked_until = 0.0
        self.revealed_indices = []
        self.hint_levels = {}

    def to_lobby_dict(self) -> dict:
        return {
            "name": self.name,
            "color": self.color,
            "ready": self.ready,
            "answered": self.answered,
            "connected": self.connected,
            "isHost": self.is_host,
        }

    def to_roster_dict(self) -> dict:
        """Vue transmise au demarrage d'une partie (format unique, cf. §1.5)."""
        return {"name": self.name, "color": self.color, "isHost": self.is_host}


@dataclass
class Room:
    """Une salle de jeu."""

    code: str
    state: RoomState = RoomState.WAITING
    players: dict[str, Player] = field(default_factory=dict)
    game: GameData | None = None
    started_at: float = 0.0
    duration_s: int = 180
    with_items: bool = True
    theme_votes: dict[str, str] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    empty_since: float | None = None

    # --- vues -------------------------------------------------------------
    @property
    def connected_players(self) -> list[Player]:
        return [p for p in self.players.values() if p.connected]

    @property
    def host(self) -> Player | None:
        return next((p for p in self.players.values() if p.is_host), None)

    @property
    def is_empty(self) -> bool:
        return not self.connected_players

    @property
    def seconds_remaining(self) -> float:
        if self.state is not RoomState.PLAYING or not self.started_at:
            return float(self.duration_s)
        return max(0.0, self.duration_s - (time.time() - self.started_at))

    def player(self, name: str) -> Player | None:
        return self.players.get(name)

    # --- mutations --------------------------------------------------------
    def promote_new_host(self) -> Player | None:
        """Garantit qu'il y a toujours exactement un hote connecte."""
        current = self.host
        if current is not None and current.connected:
            return current
        if current is not None:
            current.is_host = False
        candidates = sorted(self.connected_players, key=lambda p: p.joined_at)
        if not candidates:
            return None
        candidates[0].is_host = True
        return candidates[0]

    def reset_players_for_new_game(self) -> None:
        for player in self.players.values():
            player.reset_for_new_game()

    def all_connected_answered(self) -> bool:
        connected = self.connected_players
        return bool(connected) and all(p.answered for p in connected)

    def leaderboard(self) -> list[dict]:
        rows = [
            {
                "id": player.name,
                "name": player.name,
                "color": player.color,
                "score": player.score,
                "breakdown": player.breakdown,
                "connected": player.connected,
            }
            for player in self.players.values()
        ]
        rows.sort(key=lambda row: row["score"], reverse=True)
        return rows

    def to_lobby_dict(self) -> dict:
        return {
            "code": self.code,
            "state": self.state.value,
            "players": [p.to_lobby_dict() for p in self.players.values()],
            "withItems": self.with_items,
            "durationS": self.duration_s,
        }

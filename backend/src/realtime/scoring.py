"""Classement de fin de manche.

Le barème lui-même vit dans `src/scoring.py`, partagé avec le mode solo. Ce
module ne garde que ce qui dépend d'une salle, et réexporte les constantes
pour les appelants (et les tests) déjà écrits.
"""
from src.scoring import (  # noqa: F401 - réexport volontaire
    HINT_COST,
    PER_CORRECT,
    PER_FALSE_POSITIVE,
    REVEAL_COST,
    TIME_BONUS_PER_SECOND,
    breakdown,
    compute_score,
    hint_penalty_for,
)

from .room import Room


def build_leaderboard(room: Room) -> list[dict]:
    """Final standings, highest score first, with each player's breakdown."""
    leaderboard = [
        {
            "id": name,
            "name": name,
            "score": p.score,
            "color": p.color,
            "breakdown": p.results,
        }
        for name, p in room.players.items()
    ]
    leaderboard.sort(key=lambda x: x["score"], reverse=True)
    return leaderboard

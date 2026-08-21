"""Score arithmetic for submitted answers and end-of-round leaderboard building.

The formula lives here in one place so the client-visible numbers cannot
drift between call sites: tp*150 - fp*80 - hint_penalty - score_stolen + time bonus,
where the bonus is half a point per second left on the clock.
"""
from .room import Room

# Barème des indices, appliqué par le serveur. `frontend/src/config.js`
# expose les mêmes valeurs pour l'affichage optimiste pendant la manche.
HINT_COST = 50
REVEAL_COST = 200


def hint_penalty_for(levels: dict[int, int]) -> int:
    """Coût total des indices déverrouillés, par numéro de fausse information.

    Niveau 1 = indice, niveau 2 = révélation. Monotone : un joueur qui a payé
    le niveau 2 ne redescend pas au tarif du niveau 1.
    """
    return sum(REVEAL_COST if level >= 2 else HINT_COST for level in levels.values() if level > 0)


def compute_score(tp: int, fp: int, hint_penalty: int, score_stolen: int,
                  time_limit: float, elapsed: float) -> tuple[int, int]:
    """Return (score, time_bonus) for one player's submission."""
    time_remaining = max(0, time_limit - elapsed)
    time_bonus = int(time_remaining * 0.5)

    base_score = tp * 150
    fp_penalty = fp * 80
    score = base_score - fp_penalty - hint_penalty - score_stolen + time_bonus
    return score, time_bonus


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

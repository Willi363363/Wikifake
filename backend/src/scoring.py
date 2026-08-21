"""Barème de score, partagé par le solo (REST) et le multijoueur (WebSocket).

Ces fonctions sont pures : elles ne connaissent ni salle, ni socket, ni
session. C'est le seul endroit où les chiffres du jeu sont définis, pour que
les deux modes ne puissent pas diverger et pour que `frontend/src/config.js`
n'ait qu'une référence à refléter.
"""

PER_CORRECT = 150
PER_FALSE_POSITIVE = 80
TIME_BONUS_PER_SECOND = 0.5

# Indices : niveau 1 = coup de pouce, niveau 2 = révélation.
HINT_COST = 50
REVEAL_COST = 200


def hint_penalty_for(levels: dict[int, int]) -> int:
    """Coût total des indices déverrouillés, par numéro de fausse information.

    Monotone : un joueur qui a payé le niveau 2 ne redescend pas au tarif du
    niveau 1.
    """
    return sum(REVEAL_COST if level >= 2 else HINT_COST for level in levels.values() if level > 0)


def compute_score(tp: int, fp: int, hint_penalty: int, score_stolen: int,
                  time_limit: float, elapsed: float) -> tuple[int, int]:
    """Retourne (score, bonus de temps) pour une soumission."""
    time_remaining = max(0, time_limit - elapsed)
    time_bonus = int(time_remaining * TIME_BONUS_PER_SECOND)

    base_score = tp * PER_CORRECT
    fp_penalty = fp * PER_FALSE_POSITIVE
    score = base_score - fp_penalty - hint_penalty - score_stolen + time_bonus
    return score, time_bonus


def breakdown(tp: int, fp: int, hints_used: int, hint_penalty: int,
              score_stolen: int, time_bonus: int) -> dict:
    """Détail affiché dans le débriefing. Mêmes clés dans les deux modes."""
    return {
        "tp": tp,
        "fp": fp,
        "hintsUsed": hints_used,
        "hintPenalty": hint_penalty,
        "scoreStolen": score_stolen,
        "timeBonus": time_bonus,
    }

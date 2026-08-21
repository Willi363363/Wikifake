"""SOURCE UNIQUE de la formule de score.

Le backend est la seule autorite : il calcule le score a partir de son propre
etat (indices consommes, points voles, temps restant). Le client n'envoie plus
que sa selection de paragraphes — il ne peut plus s'auto-attribuer un bonus.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

from ..config import get_settings
from ..game.answers import AnswerCheck


@dataclass(frozen=True)
class ScoreBreakdown:
    """Detail du score, affiche tel quel dans le debrief."""

    hits: int
    false_positives: int
    missed: int
    base_points: int
    false_positive_penalty: int
    hints_used: int
    hint_penalty: int
    stolen_points: int
    time_bonus: int
    total: int

    def to_dict(self) -> dict:
        return asdict(self)


def hint_cost_units(hint_levels: dict[int, int]) -> int:
    """Convertit des niveaux d'indice en unites facturables.

    Niveau 1 (indice textuel) = 1 unite ; niveau 2 (localisation du
    paragraphe) = `reveal_cost_factor` unites. SOURCE UNIQUE du bareme,
    partagee par le solo et le multijoueur.
    """
    cfg = get_settings().score
    total = 0
    for level in hint_levels.values():
        total += cfg.reveal_cost_factor if level >= 2 else 1
    return total


def compute_score(
    check: AnswerCheck,
    *,
    seconds_remaining: float,
    hints_used: int = 0,
    stolen_points: int = 0,
) -> ScoreBreakdown:
    """Calcule le score final. Fonction pure, testable sans serveur."""
    cfg = get_settings().score

    base = check.total_hits * cfg.points_per_hit
    fp_penalty = check.total_false_positives * cfg.penalty_per_miss
    hint_penalty = max(0, hints_used) * cfg.hint_penalty
    stolen = max(0, stolen_points)
    time_bonus = int(max(0.0, seconds_remaining) * cfg.time_bonus_per_second)

    total = base - fp_penalty - hint_penalty - stolen + time_bonus

    return ScoreBreakdown(
        hits=check.total_hits,
        false_positives=check.total_false_positives,
        missed=len(check.missed),
        base_points=base,
        false_positive_penalty=fp_penalty,
        hints_used=max(0, hints_used),
        hint_penalty=hint_penalty,
        stolen_points=stolen,
        time_bonus=time_bonus,
        total=total,
    )


def provisional_score(hits_guessed: int, hints_used: int, stolen_points: int) -> int:
    """Score indicatif affiche en direct pendant la partie (sans bonus temps).

    Utilise la meme configuration que `compute_score` pour rester coherent.
    """
    cfg = get_settings().score
    return (
        max(0, hits_guessed) * cfg.points_per_hit
        - max(0, hints_used) * cfg.hint_penalty
        - max(0, stolen_points)
    )

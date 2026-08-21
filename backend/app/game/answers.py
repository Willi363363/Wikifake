"""Comparaison des reponses d'un joueur avec la verite terrain.

Module pur : aucune dependance, aucun effet de bord, entierement testable.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class AnswerCheck:
    """Resultat brut d'une correction (sans notion de points)."""

    hits: list[int]  # paragraphes falsifies correctement identifies
    false_positives: list[int]  # paragraphes sains marques a tort
    missed: list[int]  # paragraphes falsifies non trouves

    @property
    def total_hits(self) -> int:
        return len(self.hits)

    @property
    def total_false_positives(self) -> int:
        return len(self.false_positives)

    @property
    def total_targets(self) -> int:
        return len(self.hits) + len(self.missed)

    @property
    def accuracy(self) -> float:
        """Ratio de reussite (0.0 - 1.0). Pas un score : voir rooms/scoring.py."""
        if self.total_targets == 0:
            return 0.0
        return self.total_hits / self.total_targets

    def to_dict(self) -> dict:
        return {
            "hits": self.hits,
            "false_positives": self.false_positives,
            "missed": self.missed,
            "total_hits": self.total_hits,
            "total_false_positives": self.total_false_positives,
            "total_targets": self.total_targets,
            "accuracy": round(self.accuracy, 4),
        }


def check_answers(selected: Iterable[int], fake_indices: Iterable[int]) -> AnswerCheck:
    """Corrige une selection de paragraphes (indices 1-base).

    Les doublons sont ignores et l'ordre de sortie est deterministe (trie),
    ce qui rend les tests stables.
    """
    picked = {int(i) for i in selected}
    truth = {int(i) for i in fake_indices}
    return AnswerCheck(
        hits=sorted(picked & truth),
        false_positives=sorted(picked - truth),
        missed=sorted(truth - picked),
    )

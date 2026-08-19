"""Scoring engine for WikiFake multiplayer games."""
from __future__ import annotations

from dataclasses import dataclass

from .verification import check_answer

# Scoring constants
POINTS_PER_CORRECT = 150
PENALTY_PER_FALSE_POSITIVE = 80
TIME_BONUS_RATE = 0.5


@dataclass(frozen=True)
class ScoreBreakdown:
    """Immutable breakdown of a player's score."""
    tp: int
    fp: int
    time_bonus: int
    hints_used: int
    hint_penalty: int
    score_stolen: int
    total: int


def compute_score(
    selected_indices: list[int],
    correct_positions: list[dict],
    time_taken: float,
    time_limit: int,
    hints_used: int = 0,
    hint_penalty: int = 0,
    score_stolen: int = 0,
) -> tuple[ScoreBreakdown, dict]:
    """
    Compute the score for a player's answer submission.
    
    Returns:
        A tuple of (ScoreBreakdown, check_result_dict).
    """
    result = check_answer(selected_indices, correct_positions)
    tp = len(result["correct_found"])
    fp = len(result["false_positives"])
    
    time_remaining = max(0, time_limit - time_taken)
    time_bonus = int(time_remaining * TIME_BONUS_RATE)
    
    base = tp * POINTS_PER_CORRECT
    fp_cost = fp * PENALTY_PER_FALSE_POSITIVE
    total = base - fp_cost - hint_penalty - score_stolen + time_bonus
    
    breakdown = ScoreBreakdown(
        tp=tp,
        fp=fp,
        time_bonus=time_bonus,
        hints_used=hints_used,
        hint_penalty=hint_penalty,
        score_stolen=score_stolen,
        total=total,
    )
    return breakdown, result

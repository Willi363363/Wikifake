"""Formule de score : SOURCE UNIQUE, testee explicitement."""

from app.config import get_settings
from app.game.answers import check_answers
from app.rooms.scoring import compute_score, provisional_score


def test_score_components():
    cfg = get_settings().score
    check = check_answers([1, 2, 9], {1, 2, 3})
    breakdown = compute_score(check, seconds_remaining=100, hints_used=2, stolen_points=50)

    assert breakdown.hits == 2
    assert breakdown.false_positives == 1
    assert breakdown.missed == 1
    assert breakdown.base_points == 2 * cfg.points_per_hit
    assert breakdown.false_positive_penalty == cfg.penalty_per_miss
    assert breakdown.hint_penalty == 2 * cfg.hint_penalty
    assert breakdown.stolen_points == 50
    assert breakdown.time_bonus == int(100 * cfg.time_bonus_per_second)
    assert breakdown.total == (
        breakdown.base_points
        - breakdown.false_positive_penalty
        - breakdown.hint_penalty
        - 50
        + breakdown.time_bonus
    )


def test_negative_inputs_are_clamped():
    check = check_answers([], {1})
    breakdown = compute_score(check, seconds_remaining=-10, hints_used=-5, stolen_points=-20)
    assert breakdown.time_bonus == 0
    assert breakdown.hint_penalty == 0
    assert breakdown.stolen_points == 0
    assert breakdown.total == 0


def test_provisional_uses_same_config():
    cfg = get_settings().score
    assert provisional_score(3, 1, 50) == 3 * cfg.points_per_hit - cfg.hint_penalty - 50


def test_breakdown_is_serialisable():
    breakdown = compute_score(check_answers([1], {1}), seconds_remaining=0)
    payload = breakdown.to_dict()
    assert payload["hits"] == 1
    assert set(payload) == {
        "hits",
        "false_positives",
        "missed",
        "base_points",
        "false_positive_penalty",
        "hints_used",
        "hint_penalty",
        "stolen_points",
        "time_bonus",
        "total",
    }


def test_hint_cost_units():
    from app.rooms.scoring import hint_cost_units

    cfg = get_settings().score
    assert hint_cost_units({}) == 0
    assert hint_cost_units({1: 1, 2: 1}) == 2
    assert hint_cost_units({1: 2}) == cfg.reveal_cost_factor
    assert hint_cost_units({1: 2, 2: 1}) == cfg.reveal_cost_factor + 1

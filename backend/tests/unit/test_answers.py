"""Correction des reponses (module pur)."""

from app.game.answers import check_answers


def test_perfect_answer():
    check = check_answers([2, 4], {2, 4})
    assert check.hits == [2, 4]
    assert check.false_positives == []
    assert check.missed == []
    assert check.accuracy == 1.0


def test_partial_answer():
    check = check_answers([2], {2, 4})
    assert check.hits == [2]
    assert check.missed == [4]
    assert check.accuracy == 0.5


def test_false_positives():
    check = check_answers([1, 2, 5], {2, 4})
    assert check.hits == [2]
    assert check.false_positives == [1, 5]
    assert check.missed == [4]


def test_duplicates_are_ignored():
    check = check_answers([2, 2, 2, 3, 3], {2, 4})
    assert check.hits == [2]
    assert check.false_positives == [3]


def test_no_target():
    check = check_answers([1], set())
    assert check.accuracy == 0.0
    assert check.false_positives == [1]
    assert check.total_targets == 0


def test_output_is_sorted_and_deterministic():
    check = check_answers([9, 1, 5], {5, 1})
    assert check.hits == [1, 5]
    assert check.false_positives == [9]

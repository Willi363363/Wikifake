"""Selection des paragraphes a falsifier."""

from unittest.mock import patch

from app.config import get_settings
from app.game.falsifier import eligible_indices, inject_fakes


def test_eligible_indices_are_one_based():
    paragraphs = ["court", "x" * 150, "y" * 200]
    assert eligible_indices(paragraphs, min_chars=100) == [2, 3]


def test_eligible_respects_threshold():
    assert eligible_indices(["a" * 99, "b" * 100], min_chars=100) == [2]


@patch(
    "app.game.falsifier.falsify_paragraph",
    return_value={"swapped_text": "faux", "explanation": "e", "hint": "h"},
)
def test_inject_fakes_keeps_source_index(_mock, rng):
    paragraphs = ["court", "x" * 200, "y" * 200, "z" * 200]
    fakes = inject_fakes(paragraphs, "sujet", count=2, rng=rng)
    assert len(fakes) == 2
    for fake in fakes:
        assert fake.paragraph_index in (2, 3, 4)
        assert fake.original_text == paragraphs[fake.paragraph_index - 1]


@patch("app.game.falsifier.falsify_paragraph", return_value=None)
def test_llm_failures_are_skipped(_mock, rng):
    assert inject_fakes(["x" * 200] * 3, "sujet", count=2, rng=rng) == []


def test_no_eligible_paragraph_returns_empty(rng):
    threshold = get_settings().game.min_paragraph_chars
    assert inject_fakes(["a" * (threshold - 1)], "sujet", rng=rng) == []


@patch(
    "app.game.falsifier.falsify_paragraph",
    return_value={"swapped_text": "faux", "explanation": "e", "hint": "h"},
)
def test_count_is_capped_by_available_paragraphs(_mock, rng):
    fakes = inject_fakes(["x" * 200, "y" * 200], "sujet", count=10, rng=rng)
    assert len(fakes) == 2

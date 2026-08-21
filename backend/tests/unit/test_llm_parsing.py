"""Extraction JSON des reponses LLM (mutualisee, plus dupliquee)."""

from app.game.llm import parse_json_object, strip_code_fences


def test_plain_json():
    assert parse_json_object('{"a": 1}') == {"a": 1}


def test_fenced_json():
    assert parse_json_object('```json\n{"a": 1}\n```') == {"a": 1}


def test_fence_without_language():
    assert parse_json_object('```\n{"a": 1}\n```') == {"a": 1}


def test_json_with_surrounding_prose():
    raw = 'Voici le resultat :\n{"a": 1, "b": "x"}\nVoila.'
    assert parse_json_object(raw) == {"a": 1, "b": "x"}


def test_invalid_returns_none():
    assert parse_json_object("pas du json") is None
    assert parse_json_object("") is None


def test_non_object_json_returns_none():
    assert parse_json_object("[1, 2]") is None


def test_strip_code_fences_noop():
    assert strip_code_fences("abc") == "abc"

"""Cache des articles falsifiés.

Chaque partie régénérait tout depuis zéro : c'était le premier poste de coût
du projet, et la cause des dix secondes d'attente au lancement.
"""
import os

if "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = "dummy-key-for-ci"

import random
from unittest.mock import patch

import pytest

from src import article_cache, usage
from src.game import generate_game

GAME = {
    "topic": "Paris",
    "paragraphs": ["un", "deux", "trois"],
    "positions": [{"paragraph_index": 2, "false_info_number": 1, "hint": "h", "explanation": "e"}],
    "misinformations": [{"original_text": "o", "swapped_text": "s"}],
    "total_false_statements": 1,
    "wikipedia_url": "https://fr.wikipedia.org/wiki/Paris",
}


@pytest.fixture(autouse=True)
def clean():
    article_cache.clear()
    usage.reset()
    yield
    article_cache.clear()
    usage.reset()


# --- clé de cache ------------------------------------------------------------

@pytest.mark.parametrize("variant", ["Paris", "paris", "  PARIS  ", "PÁRIS", "paris"])
def test_equivalent_searches_share_one_entry(variant):
    article_cache.put("Paris", GAME)
    assert article_cache.get(variant) is not None


def test_different_categories_do_not_collide():
    article_cache.put("Paris", GAME)
    assert article_cache.get("Lyon") is None


def test_empty_category_is_ignored():
    article_cache.put("   ", GAME)
    assert article_cache.get("   ") is None


# --- isolation ---------------------------------------------------------------

def test_entries_are_copied_not_shared():
    """Une partie modifie son contenu en cours de route : deux parties ne
    doivent jamais partager les mêmes listes."""
    article_cache.put("Paris", GAME)

    first = article_cache.get("Paris")
    first["paragraphs"].append("MUTATION")
    first["positions"][0]["paragraph_index"] = 999

    second = article_cache.get("Paris")
    assert len(second["paragraphs"]) == 3
    assert second["positions"][0]["paragraph_index"] == 2
    # La source d'origine est intacte elle aussi.
    assert len(GAME["paragraphs"]) == 3


# --- expiration et bornes ----------------------------------------------------

def test_expired_entries_are_dropped(monkeypatch):
    monkeypatch.setattr(article_cache, "ARTICLE_CACHE_TTL", 0)
    article_cache.put("Paris", GAME)
    assert article_cache.get("Paris") is None


def test_variants_are_capped(monkeypatch):
    monkeypatch.setattr(article_cache, "ARTICLE_CACHE_VARIANTS", 2)
    for i in range(5):
        article_cache.put("Paris", {**GAME, "topic": f"Paris {i}"})
    assert article_cache.stats()["articles"] == 2


def test_least_recently_used_category_is_evicted(monkeypatch):
    monkeypatch.setattr(article_cache, "ARTICLE_CACHE_MAX_CATEGORIES", 2)
    article_cache.put("a", GAME)
    article_cache.put("b", GAME)
    article_cache.get("a")          # « a » redevient la plus récente
    article_cache.put("c", GAME)

    assert article_cache.get("b") is None
    assert article_cache.get("a") is not None
    assert article_cache.get("c") is not None


def test_several_variants_are_reachable():
    """Une même recherche ne doit pas servir éternellement le même article."""
    for i in range(3):
        article_cache.put("Paris", {**GAME, "topic": f"variante {i}"})

    seen = {article_cache.get("Paris", rng=random.Random(seed))["topic"] for seed in range(30)}
    assert len(seen) > 1


# --- effet sur la génération -------------------------------------------------

@patch("src.game._generator.start_game", return_value=GAME)
def test_second_game_costs_no_llm_call(start_game):
    first = generate_game("Paris")
    second = generate_game("paris")

    assert first is not None and second is not None
    # Un seul appel au pipeline pour deux parties servies.
    assert start_game.call_count == 1

    report = usage.snapshot()
    assert report["games_generated"] == 1
    assert report["games_served_from_cache"] == 1
    assert report["cache_hit_rate"] == 0.5


@patch("src.game._generator.start_game", return_value=GAME)
def test_cache_can_be_bypassed(start_game):
    generate_game("Paris")
    generate_game("Paris", use_cache=False)
    assert start_game.call_count == 2


@patch("src.game._generator.start_game", return_value=None)
def test_failed_generation_is_not_cached(start_game):
    assert generate_game("zzz") is None
    assert article_cache.stats()["articles"] == 0
    assert usage.snapshot()["games_generated"] == 0

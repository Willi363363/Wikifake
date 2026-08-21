"""Compteurs de consommation du modèle.

Sans mesure, impossible de répondre à « combien coûte une partie ? » — et donc
de savoir si un modèle publicitaire tient.
"""
import os

if "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = "dummy-key-for-ci"

import pytest
from fastapi.testclient import TestClient

from main import app
from src import usage

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean():
    usage.reset()
    yield
    usage.reset()


def test_counts_tokens_when_the_model_reports_them():
    usage.record_call("falsification", "prompt", "sortie",
                      {"input_tokens": 1200, "output_tokens": 800})
    report = usage.snapshot()
    assert report["totals"] == {"llm_calls": 1, "input_tokens": 1200, "output_tokens": 800}


def test_falls_back_to_characters_without_metadata():
    """Certains modèles n'exposent pas l'usage : les caractères restent un
    proxy exploitable pour comparer des ordres de grandeur."""
    usage.record_call("choix_de_sujet", "x" * 40, "y" * 10, None)
    counter = usage.snapshot()["by_kind"]["choix_de_sujet"]
    assert counter["prompt_chars"] == 40
    assert counter["output_chars"] == 10
    assert counter["input_tokens"] == 0


def test_counts_failures_separately():
    usage.record_call("falsification", "p", "", None, failed=True)
    counter = usage.snapshot()["by_kind"]["falsification"]
    assert counter["calls"] == 1
    assert counter["failures"] == 1


def test_cost_per_generated_game_ignores_cache_hits():
    """C'est le chiffre qui compte : ce que coûte une partie RÉELLEMENT
    générée, pas une moyenne diluée par le cache."""
    usage.record_call("falsification", "p", "o", {"input_tokens": 1000, "output_tokens": 500})
    usage.record_game(from_cache=False)
    usage.record_game(from_cache=True)
    usage.record_game(from_cache=True)

    report = usage.snapshot()
    assert report["per_generated_game"]["input_tokens"] == 1000
    assert report["per_generated_game"]["llm_calls"] == 1
    assert report["cache_hit_rate"] == pytest.approx(2 / 3, abs=0.001)


def test_empty_report_does_not_divide_by_zero():
    report = usage.snapshot()
    assert report["per_generated_game"]["llm_calls"] == 0
    assert report["cache_hit_rate"] == 0


def test_route_exposes_usage_and_cache():
    payload = client.get("/api/usage").json()
    assert "usage" in payload
    assert "cache" in payload
    assert "ttl_seconds" in payload["cache"]

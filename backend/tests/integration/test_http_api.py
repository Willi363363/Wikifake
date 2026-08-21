"""Routes HTTP."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.game.builder import GameBuildError
from app.main import create_app
from tests.conftest import make_game


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client


def test_ping(client):
    assert client.get("/ping").json() == {"status": "alive"}


def test_health(client):
    payload = client.get("/api/health").json()
    assert payload["status"] == "ok"
    assert payload["items_loaded"] > 0


def test_public_config_exposes_items_and_commands(client):
    payload = client.get("/api/config").json()
    assert len(payload["items"]) > 0
    assert "submit_answer" in payload["wsCommands"]
    assert payload["duration"]["min"] < payload["duration"]["max"]


def test_create_room(client):
    payload = client.post("/api/multiplayer/create").json()
    assert len(payload["room_code"]) == 6


def test_room_info_404(client):
    assert client.get("/api/multiplayer/NOPE12").status_code == 404


def test_room_info_ok(client):
    code = client.post("/api/multiplayer/create").json()["room_code"]
    payload = client.get(f"/api/multiplayer/{code}").json()
    assert payload["code"] == code
    assert payload["state"] == "waiting"


def test_start_game_validation(client):
    assert client.post("/api/game/start", json={}).status_code == 422
    assert client.post("/api/game/start", json={"category": ""}).status_code == 422


@patch("app.api.routes_game.build_game", side_effect=GameBuildError("rien trouve"))
def test_start_game_reports_build_failure(_mock, client):
    response = client.post("/api/game/start", json={"category": "zzz"})
    assert response.status_code == 400
    assert "rien trouve" in response.json()["detail"]


@patch("app.api.routes_game.build_game", return_value=make_game((2, 4)))
def test_solo_full_flow(_mock, client):
    started = client.post("/api/game/start", json={"category": "test"}).json()
    session_id = started["session_id"]

    # La solution n'est pas dans les paragraphes envoyes.
    for paragraph in started["game"]["paragraphs"]:
        assert set(paragraph) == {"index", "text"}

    hint = client.post(f"/api/game/{session_id}/hint", json={"target_index": 1}).json()
    assert hint["hints_used"] == 1
    assert hint["hint"]

    result = client.post(f"/api/game/{session_id}/submit", json={"selection": [2, 4, 5]}).json()
    assert result["check"]["hits"] == [2, 4]
    assert result["check"]["false_positives"] == [5]
    assert result["breakdown"]["hints_used"] == 1
    assert len(result["solution"]) == 2


def test_solo_unknown_session(client):
    assert client.post("/api/game/nope/submit", json={"selection": []}).status_code == 404


@patch("app.api.routes_game.build_game", return_value=make_game((1,)))
def test_two_solo_sessions_are_independent(_mock, client):
    """Regression : l'ancien singleton partage ecrasait la partie precedente."""
    first = client.post("/api/game/start", json={"category": "a"}).json()["session_id"]
    second = client.post("/api/game/start", json={"category": "b"}).json()["session_id"]
    assert first != second
    client.post(f"/api/game/{first}/hint", json={"target_index": 1})
    r1 = client.post(f"/api/game/{first}/submit", json={"selection": [1]}).json()
    r2 = client.post(f"/api/game/{second}/submit", json={"selection": [1]}).json()
    assert r1["breakdown"]["hints_used"] == 1
    assert r2["breakdown"]["hints_used"] == 0


def test_flag_report_validation(client):
    assert client.post("/api/flag-report", json={}).status_code == 422


@patch("app.flags.service.verifier.fetch_context", return_value="contexte")
@patch(
    "app.flags.service.verifier.verify",
    return_value={
        "verdict": "likely_valid",
        "confidence": 90,
        "reasoning": "ok",
        "sources_found": [],
        "recommendation": "approve_for_review",
    },
)
def test_flag_report_flow(_verify, _context, client, tmp_path, monkeypatch):
    monkeypatch.setenv("WIKIFAKE_DATA_DIR", str(tmp_path))
    from app.config import reset_settings_cache

    reset_settings_cache()
    response = client.post(
        "/api/flag-report",
        json={
            "flagged_claim": "Une affirmation douteuse.",
            "proposed_correction": "La bonne version.",
            "article_title": "Test",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "pending_human_review"
    assert payload["verification"]["verdict"] == "likely_valid"
    assert (tmp_path / "complaints.jsonl").exists()
    reset_settings_cache()


def test_missing_frontend_build_is_explained(client):
    response = client.get("/")
    # 503 + message d'aide si le bundle n'est pas construit, 200 sinon.
    assert response.status_code in (200, 503)


@patch("app.api.routes_game.build_game", return_value=make_game((2, 4)))
def test_solo_hint_levels_are_billed(_mock, client):
    session_id = client.post("/api/game/start", json={"category": "x"}).json()["session_id"]

    level1 = client.post(f"/api/game/{session_id}/hint", json={"target_index": 1}).json()
    assert level1["hints_used"] == 1
    assert "paragraph_index" not in level1

    level2 = client.post(
        f"/api/game/{session_id}/hint", json={"target_index": 1, "level": 2}
    ).json()
    assert level2["paragraph_index"] in (2, 4)
    assert level2["hints_used"] == 4  # localisation = 4 unites

    result = client.post(f"/api/game/{session_id}/submit", json={"selection": [2, 4]}).json()
    assert result["breakdown"]["hints_used"] == 4
    assert result["breakdown"]["hint_penalty"] == 200

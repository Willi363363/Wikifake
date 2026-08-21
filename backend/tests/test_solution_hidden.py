"""La solution ne quitte le serveur qu'une fois la manche jouée.

Non-régression : `positions` — les index des paragraphes falsifiés, leurs
explications et leurs indices — partait dans le payload de départ, en solo
comme en multijoueur. La solution était lisible dans le DevTools avant le
premier clic.
"""
import json
import os

if "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = "dummy-key-for-ci"

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app, rooms
from src import solo
from src.realtime import handlers
from src.scoring import HINT_COST, REVEAL_COST

client = TestClient(app)

POSITIONS = [
    {"paragraph_index": 2, "false_info_number": 1, "false_statement": "FAUX 2",
     "hint": "indice 1", "explanation": "vérité 1"},
    {"paragraph_index": 4, "false_info_number": 2, "false_statement": "FAUX 4",
     "hint": "indice 2", "explanation": "vérité 2"},
]

GAME_DATA = {
    "topic": "Sujet",
    "paragraphs": [f"paragraphe {i}" for i in range(1, 6)],
    "misinformations": [{"original_text": "SECRET", "swapped_text": "FAUX 2"}],
    "positions": POSITIONS,
    "total_false_statements": 2,
    "wikipedia_url": "https://fr.wikipedia.org/wiki/Sujet",
}

SOLUTION_MARKERS = ("positions", "false_info_number", "explanation", "hint", "misinformations")


@pytest.fixture(autouse=True)
def clean_state():
    rooms.clear()
    solo.clear()
    yield
    rooms.clear()
    solo.clear()


def assert_no_solution(payload: dict) -> None:
    """Aucun indice de la solution, ni en clé ni en valeur."""
    for key in SOLUTION_MARKERS:
        assert key not in payload, f"{key!r} ne doit pas être transmis au démarrage"
    serialised = json.dumps(payload, ensure_ascii=False)
    for leak in ("vérité 1", "vérité 2", "indice 1", "indice 2", "SECRET"):
        assert leak not in serialised, f"{leak!r} fuite dans le payload"


def drain(ws, kind: str, limit: int = 12) -> dict:
    for _ in range(limit):
        message = ws.receive_json()
        if message["type"] == kind:
            return message
    raise AssertionError(f"message {kind!r} jamais reçu")


# --- solo --------------------------------------------------------------------

@patch("src.api.game.generate_game", return_value=GAME_DATA)
def test_solo_start_hides_the_solution(_mock):
    payload = client.post("/api/game/start", json={"category": "Sujet"}).json()
    assert_no_solution(payload)
    assert payload["total_fakes"] == 2
    assert len(payload["paragraphs"]) == 5
    assert payload["session_id"]


@patch("src.api.game.generate_game", return_value=GAME_DATA)
def test_solo_submit_returns_the_solution(_mock):
    sid = client.post("/api/game/start", json={"category": "Sujet"}).json()["session_id"]
    result = client.post("/api/game/submit", json={"session_id": sid, "answers": [2, 4, 5]}).json()

    assert result["breakdown"]["tp"] == 2
    assert result["breakdown"]["fp"] == 1
    assert [p["paragraph_index"] for p in result["positions"]] == [2, 4]
    assert result["positions"][0]["explanation"] == "vérité 1"


@patch("src.api.game.generate_game", return_value=GAME_DATA)
def test_solo_hint_is_billed_by_the_server(_mock):
    sid = client.post("/api/game/start", json={"category": "Sujet"}).json()["session_id"]

    first = client.post("/api/game/hint", json={"session_id": sid, "number": 1}).json()
    assert first["hint"] == "indice 1"
    assert first["cost"] == HINT_COST
    assert "truth" not in first  # niveau 1 ne révèle pas la vérité

    second = client.post("/api/game/hint",
                         json={"session_id": sid, "number": 1, "level": 2}).json()
    assert second["truth"] == "vérité 1"
    assert second["paragraph_index"] == 2
    assert second["hint_penalty"] == REVEAL_COST

    result = client.post("/api/game/submit", json={"session_id": sid, "answers": [2, 4]}).json()
    assert result["breakdown"]["hintsUsed"] == 1
    assert result["breakdown"]["hintPenalty"] == REVEAL_COST


@patch("src.api.game.generate_game", return_value=GAME_DATA)
def test_solo_scan_designates_a_real_fake(_mock):
    sid = client.post("/api/game/start", json={"category": "Sujet"}).json()["session_id"]

    first = client.post("/api/game/scan", json={"session_id": sid, "marked": []}).json()
    assert first["paragraph_index"] in (2, 4)

    # Le second scan ne répète pas le premier.
    second = client.post("/api/game/scan", json={"session_id": sid, "marked": []}).json()
    assert {first["paragraph_index"], second["paragraph_index"]} == {2, 4}

    # Plus rien à révéler.
    third = client.post("/api/game/scan", json={"session_id": sid, "marked": []}).json()
    assert third["paragraph_index"] is None


@patch("src.api.game.generate_game", return_value=GAME_DATA)
def test_solo_scan_skips_already_marked(_mock):
    sid = client.post("/api/game/start", json={"category": "Sujet"}).json()["session_id"]
    result = client.post("/api/game/scan", json={"session_id": sid, "marked": [2]}).json()
    assert result["paragraph_index"] == 4


@patch("src.api.game.generate_game", return_value=GAME_DATA)
def test_solo_sessions_are_isolated(_mock):
    first = client.post("/api/game/start", json={"category": "a"}).json()["session_id"]
    second = client.post("/api/game/start", json={"category": "b"}).json()["session_id"]

    client.post("/api/game/hint", json={"session_id": first, "number": 1})

    r1 = client.post("/api/game/submit", json={"session_id": first, "answers": [2]}).json()
    r2 = client.post("/api/game/submit", json={"session_id": second, "answers": [2]}).json()
    assert r1["breakdown"]["hintsUsed"] == 1
    assert r2["breakdown"]["hintsUsed"] == 0


def test_solo_unknown_session():
    assert client.post("/api/game/submit", json={"session_id": "nope", "answers": []}).status_code == 404
    assert client.post("/api/game/hint", json={"session_id": "nope", "number": 1}).status_code == 404
    assert client.post("/api/game/scan", json={"session_id": "nope"}).status_code == 404


# --- multijoueur -------------------------------------------------------------

def start_round(code: str) -> None:
    room = rooms[code]
    room.state = "playing"
    room.time_limit = 300
    room.game_data = GAME_DATA


def test_multiplayer_game_start_hides_the_solution():
    code = client.post("/api/multiplayer/create").json()["room_code"]
    with client.websocket_connect(f"/ws/{code}/host") as ws:
        drain(ws, "lobby_update")
        with patch.object(handlers, "generate_game", return_value=GAME_DATA):
            ws.send_json({"type": "start_game", "category": "Sujet"})
            payload = drain(ws, "game_start")["data"]

    assert_no_solution(payload)
    assert payload["total_fakes"] == 2


def test_multiplayer_game_end_reveals_the_solution():
    code = client.post("/api/multiplayer/create").json()["room_code"]
    with client.websocket_connect(f"/ws/{code}/solo") as ws:
        drain(ws, "lobby_update")
        start_round(code)
        ws.send_json({"type": "submit_answer", "answers": [2]})
        end = drain(ws, "game_end")

    assert [p["paragraph_index"] for p in end["positions"]] == [2, 4]
    assert end["leaderboard"][0]["breakdown"]["tp"] == 1


def test_scanner_is_resolved_by_the_server():
    code = client.post("/api/multiplayer/create").json()["room_code"]
    with client.websocket_connect(f"/ws/{code}/solo") as ws:
        drain(ws, "lobby_update")
        start_round(code)

        rooms[code].players["solo"].items.append(
            {"id": "SCANNER", "name": "Détecteur", "icon": "🔎", "instance_id": "s1"}
        )
        ws.send_json({"type": "use_item", "instance_id": "s1", "targets": ["solo"], "marked": [2]})
        result = drain(ws, "scanner_result")

        # Le seul faux non coché est le paragraphe 4.
        assert result["paragraph_index"] == 4
        assert rooms[code].players["solo"].scanned == [4]

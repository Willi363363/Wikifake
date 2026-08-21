"""Round-end behaviour: the score formula and the game_end broadcast.

This path (submit -> everyone answered -> leaderboard) carries the game's real
stakes but had no coverage, so a refactor could silently change what players
score. These tests pin the arithmetic and the end-of-round state reset.
"""
import os

if "OPENAI_API_KEY" not in os.environ:
    os.environ["OPENAI_API_KEY"] = "sk-dummy-test-key-for-ci"

import pytest
from fastapi.testclient import TestClient

from main import app, rooms
from src.realtime.room import Room, Player
from src.realtime.scoring import compute_score, build_leaderboard

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_rooms():
    rooms.clear()
    yield
    rooms.clear()


def test_compute_score_full_formula():
    # 3 correct, 1 false positive, 20 hint penalty, 50 stolen, 200s left on a 300s round
    score, time_bonus = compute_score(tp=3, fp=1, hint_penalty=20, score_stolen=50,
                                      time_limit=300, elapsed=100)
    assert time_bonus == 100                      # 200 remaining * 0.5
    assert score == 3 * 150 - 1 * 80 - 20 - 50 + 100 == 400


def test_compute_score_never_awards_bonus_past_the_deadline():
    score, time_bonus = compute_score(tp=1, fp=0, hint_penalty=0, score_stolen=0,
                                      time_limit=60, elapsed=90)
    assert time_bonus == 0
    assert score == 150


def test_build_leaderboard_sorts_by_score_descending():
    room = Room()
    room.players = {
        "low": Player(socket=None, color="#111", score=10),
        "high": Player(socket=None, color="#222", score=900),
        "mid": Player(socket=None, color="#333", score=300),
    }
    assert [entry["name"] for entry in build_leaderboard(room)] == ["high", "mid", "low"]


def test_round_ends_when_every_player_has_answered():
    room_code = client.post("/api/multiplayer/create").json()["room_code"]

    with client.websocket_connect(f"/ws/{room_code}/p1") as ws1, \
         client.websocket_connect(f"/ws/{room_code}/p2") as ws2:
        ws1.receive_json()
        ws1.receive_json()
        ws2.receive_json()

        # Put the room mid-round without touching the LLM: one sabotaged paragraph.
        room = rooms[room_code]
        room.state = "playing"
        room.time_limit = 300
        room.game_data = {"positions": [
            {"paragraph_index": 1, "false_info_number": 1, "hint": "indice 1", "explanation": "vérité 1"},
            {"paragraph_index": 2, "false_info_number": 2, "hint": "indice 2", "explanation": "vérité 2"},
        ]}
        for player in room.players.values():
            player.ready = True

        # p1 finds both, p2 finds one and mis-flags another.
        ws1.send_json({"type": "submit_answer", "answers": [1, 2],
                       "hintsUsed": 0, "hintPenalty": 0, "scoreStolen": 0})
        ws1.receive_json()  # lobby_update: p2 has not answered yet

        # p2 achète un indice : la pénalité vient de cet appel, pas de sa
        # propre déclaration à la soumission.
        ws2.send_json({"type": "unlock_hint", "number": 1, "level": 1})
        # Le lobby_update déclenché par p1 est encore en file devant.
        hint = ws2.receive_json()
        while hint["type"] != "hint_unlocked":
            hint = ws2.receive_json()
        assert hint["hint"] == "indice 1"

        ws2.send_json({"type": "submit_answer", "answers": [1, 3]})

        end1 = ws1.receive_json()
        # p2 still has p1's queued lobby_update in front of the round-end message.
        end2 = ws2.receive_json()
        while end2["type"] != "game_end":
            end2 = ws2.receive_json()

        # Checked while still connected: the room is deleted once everyone leaves.
        assert rooms[room_code].state == "waiting"
        assert all(not p.ready for p in rooms[room_code].players.values())

    assert end1["type"] == "game_end"
    assert end2["type"] == "game_end"

    leaderboard = end1["leaderboard"]
    assert [entry["name"] for entry in leaderboard] == ["p1", "p2"]
    assert leaderboard[0]["score"] > leaderboard[1]["score"]
    assert leaderboard[0]["breakdown"]["tp"] == 2
    assert leaderboard[1]["breakdown"]["fp"] == 1
    assert leaderboard[1]["breakdown"]["hintPenalty"] == 50

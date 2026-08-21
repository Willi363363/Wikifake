"""Le score ne dépend plus de ce que le client déclare.

Non-régression : `submit_answer` lisait `hintsUsed`, `hintPenalty` et
`scoreStolen` dans le message du joueur. Envoyer 0 effaçait ses pénalités,
et une valeur négative offrait un bonus arbitraire.
"""
import os

if "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = "dummy-key-for-ci"

import pytest
from fastapi.testclient import TestClient

from main import app, rooms
from src.realtime.items import STEAL_AMOUNT
from src.realtime.scoring import HINT_COST, REVEAL_COST

client = TestClient(app)

POSITIONS = [
    {"paragraph_index": 1, "false_info_number": 1, "hint": "indice 1", "explanation": "vérité 1"},
    {"paragraph_index": 2, "false_info_number": 2, "hint": "indice 2", "explanation": "vérité 2"},
]


@pytest.fixture(autouse=True)
def clear_rooms():
    rooms.clear()
    yield
    rooms.clear()


def start_round(code: str) -> None:
    room = rooms[code]
    room.state = "playing"
    room.time_limit = 300
    room.game_data = {"positions": POSITIONS}


def drain(ws, kind: str, limit: int = 12) -> dict:
    for _ in range(limit):
        message = ws.receive_json()
        if message["type"] == kind:
            return message
    raise AssertionError(f"message {kind!r} jamais reçu")


def test_declared_penalties_are_ignored():
    code = client.post("/api/multiplayer/create").json()["room_code"]
    with client.websocket_connect(f"/ws/{code}/solo") as ws:
        drain(ws, "lobby_update")
        start_round(code)

        # Aucun indice acheté, mais le client en déclare, et s'offre au passage
        # un vol négatif (donc un bonus).
        ws.send_json({
            "type": "submit_answer", "answers": [1, 2],
            "hintsUsed": 9, "hintPenalty": 9999, "scoreStolen": -100000,
        })
        breakdown = drain(ws, "game_end")["leaderboard"][0]["breakdown"]

        assert breakdown["hintsUsed"] == 0
        assert breakdown["hintPenalty"] == 0
        assert breakdown["tp"] == 2


def test_paid_hint_cannot_be_cancelled_by_the_client():
    code = client.post("/api/multiplayer/create").json()["room_code"]
    with client.websocket_connect(f"/ws/{code}/solo") as ws:
        drain(ws, "lobby_update")
        start_round(code)

        ws.send_json({"type": "unlock_hint", "number": 1, "level": 1})
        assert drain(ws, "hint_unlocked")["cost"] == HINT_COST

        ws.send_json({"type": "submit_answer", "answers": [1, 2], "hintPenalty": 0})
        breakdown = drain(ws, "game_end")["leaderboard"][0]["breakdown"]

        assert breakdown["hintsUsed"] == 1
        assert breakdown["hintPenalty"] == HINT_COST


def test_hint_levels_are_monotonic_and_billed_once():
    code = client.post("/api/multiplayer/create").json()["room_code"]
    with client.websocket_connect(f"/ws/{code}/solo") as ws:
        drain(ws, "lobby_update")
        start_round(code)

        ws.send_json({"type": "unlock_hint", "number": 1, "level": 2})
        revealed = drain(ws, "hint_unlocked")
        assert revealed["level"] == 2
        assert revealed["truth"] == "vérité 1"
        assert revealed["paragraph_index"] == 1

        # Redemander le niveau 1, ou répéter le niveau 2, ne change pas la facture.
        ws.send_json({"type": "unlock_hint", "number": 1, "level": 1})
        assert drain(ws, "hint_unlocked")["level"] == 2
        ws.send_json({"type": "unlock_hint", "number": 1, "level": 2})
        assert drain(ws, "hint_unlocked")["hint_penalty"] == REVEAL_COST

        ws.send_json({"type": "submit_answer", "answers": [1, 2]})
        breakdown = drain(ws, "game_end")["leaderboard"][0]["breakdown"]
        assert breakdown["hintsUsed"] == 1
        assert breakdown["hintPenalty"] == REVEAL_COST


def test_hint_text_is_never_sent_before_being_paid():
    """Le seul canal pour obtenir un indice est `unlock_hint`."""
    code = client.post("/api/multiplayer/create").json()["room_code"]
    with client.websocket_connect(f"/ws/{code}/solo") as ws:
        drain(ws, "lobby_update")
        start_round(code)
        ws.send_json({"type": "unlock_hint", "number": 42})  # inexistant
        ws.send_json({"type": "submit_answer", "answers": []})
        end = drain(ws, "game_end")
        assert rooms[code].players["solo"].hint_levels == {}
        assert end["leaderboard"][0]["breakdown"]["hintPenalty"] == 0


def test_score_steal_is_applied_by_the_server():
    code = client.post("/api/multiplayer/create").json()["room_code"]
    with client.websocket_connect(f"/ws/{code}/thief") as thief, \
         client.websocket_connect(f"/ws/{code}/victim") as victim:
        drain(thief, "lobby_update")
        drain(victim, "lobby_update")
        start_round(code)

        room = rooms[code]
        room.players["thief"].items.append(
            {"id": "SCORE_STEAL", "name": "Pillage", "icon": "⚡", "instance_id": "i1"}
        )
        thief.send_json({"type": "use_item", "instance_id": "i1", "targets": ["victim"]})
        drain(victim, "item_effect")

        assert room.players["victim"].score_stolen == STEAL_AMOUNT

        victim.send_json({"type": "submit_answer", "answers": [1, 2], "scoreStolen": 0})
        thief.send_json({"type": "submit_answer", "answers": [1, 2]})

        end = drain(thief, "game_end")
        rows = {row["name"]: row for row in end["leaderboard"]}
        # Même détection, mais la victime a bien perdu les points volés.
        assert rows["victim"]["score"] == rows["thief"]["score"] - STEAL_AMOUNT


def test_hint_lock_blocks_purchases_server_side():
    code = client.post("/api/multiplayer/create").json()["room_code"]
    with client.websocket_connect(f"/ws/{code}/jammer") as jammer, \
         client.websocket_connect(f"/ws/{code}/target") as target:
        drain(jammer, "lobby_update")
        drain(target, "lobby_update")
        start_round(code)

        room = rooms[code]
        room.players["jammer"].items.append(
            {"id": "HINT_LOCK", "name": "Brouilleur", "icon": "🔒", "instance_id": "j1"}
        )
        jammer.send_json({"type": "use_item", "instance_id": "j1", "targets": ["target"]})
        drain(target, "item_effect")

        target.send_json({"type": "unlock_hint", "number": 1, "level": 1})
        error = drain(target, "error")
        assert error["code"] == "hints_blocked"
        assert room.players["target"].hint_levels == {}


def test_round_reset_clears_penalties():
    code = client.post("/api/multiplayer/create").json()["room_code"]
    with client.websocket_connect(f"/ws/{code}/solo") as ws:
        drain(ws, "lobby_update")
        start_round(code)
        ws.send_json({"type": "unlock_hint", "number": 1, "level": 2})
        drain(ws, "hint_unlocked")

        player = rooms[code].players["solo"]
        player.score_stolen = 999
        player.reset_round()

        assert player.hint_levels == {}
        assert player.score_stolen == 0
        assert player.hints_used == 0

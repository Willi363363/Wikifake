"""Protocole WebSocket de bout en bout (sans appel LLM)."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect

from app.main import create_app
from app.rooms.models import RoomState
from app.rooms.store import get_room_store
from tests.conftest import make_game


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client


def new_room(client) -> str:
    return client.post("/api/multiplayer/create").json()["room_code"]


def drain(ws, kind: str, limit: int = 12) -> dict:
    """Lit jusqu'au premier message du type demande."""
    for _ in range(limit):
        message = ws.receive_json()
        if message["type"] == kind:
            return message
    raise AssertionError(f"Message {kind!r} jamais recu")


def test_join_sends_lobby(client):
    code = new_room(client)
    with client.websocket_connect(f"/ws/{code}/alice") as ws:
        lobby = drain(ws, "lobby_update")
        assert lobby["room"]["players"][0]["name"] == "alice"
        assert lobby["room"]["players"][0]["isHost"] is True


def test_unknown_room_is_rejected(client):
    with pytest.raises(WebSocketDisconnect), client.websocket_connect("/ws/ZZZZZZ/alice") as ws:
        while True:
            ws.receive_json()


def test_invalid_name_is_rejected(client):
    code = new_room(client)
    long_name = "x" * 80
    with (
        pytest.raises(WebSocketDisconnect),
        client.websocket_connect(f"/ws/{code}/{long_name}") as ws,
    ):
        while True:
            ws.receive_json()


def test_unknown_command_returns_error(client):
    code = new_room(client)
    with client.websocket_connect(f"/ws/{code}/alice") as ws:
        drain(ws, "lobby_update")
        ws.send_json({"type": "n_importe_quoi"})
        error = drain(ws, "error")
        assert error["code"] == "unknown_command"


def test_bad_json_returns_error(client):
    code = new_room(client)
    with client.websocket_connect(f"/ws/{code}/alice") as ws:
        drain(ws, "lobby_update")
        ws.send_text("{pas du json")
        assert drain(ws, "error")["code"] == "bad_json"


def test_non_host_cannot_start_vote(client):
    """Regression §6.2 : l'hote etait purement client, n'importe qui pouvait
    lancer la partie."""
    code = new_room(client)
    with (
        client.websocket_connect(f"/ws/{code}/alice") as host,
        client.websocket_connect(f"/ws/{code}/bob") as guest,
    ):
        drain(host, "lobby_update")
        drain(guest, "lobby_update")
        guest.send_json({"type": "start_vote"})
        error = drain(guest, "error")
        assert error["code"] == "not_host"
        assert get_room_store().get(code).state is RoomState.WAITING


def test_host_can_start_vote(client):
    code = new_room(client)
    with client.websocket_connect(f"/ws/{code}/alice") as host:
        drain(host, "lobby_update")
        host.send_json({"type": "start_vote", "payload": {"durationS": 60}})
        drain(host, "theme_vote_start")
        room = get_room_store().get(code)
        assert room.state is RoomState.THEME_VOTING
        assert room.duration_s == 60


def test_options_are_clamped_by_server(client):
    code = new_room(client)
    with client.websocket_connect(f"/ws/{code}/alice") as host:
        drain(host, "lobby_update")
        host.send_json({"type": "set_options", "payload": {"durationS": 999999}})
        lobby = drain(host, "lobby_update")
        assert lobby["room"]["durationS"] == 600


def test_ready_state_is_broadcast(client):
    code = new_room(client)
    with client.websocket_connect(f"/ws/{code}/alice") as ws:
        drain(ws, "lobby_update")
        ws.send_json({"type": "set_ready", "payload": {"ready": True}})
        lobby = drain(ws, "lobby_update")
        assert lobby["room"]["players"][0]["ready"] is True


def test_chat_is_relayed_and_truncated(client):
    code = new_room(client)
    with (
        client.websocket_connect(f"/ws/{code}/alice") as a,
        client.websocket_connect(f"/ws/{code}/bob") as b,
    ):
        drain(a, "lobby_update")
        drain(b, "lobby_update")
        a.send_json({"type": "chat_message", "payload": {"content": "x" * 5000}})
        message = drain(b, "chat_message")
        assert message["sender"] == "alice"
        assert len(message["content"]) == 400


def test_cursor_is_not_echoed_to_sender(client):
    code = new_room(client)
    with (
        client.websocket_connect(f"/ws/{code}/alice") as a,
        client.websocket_connect(f"/ws/{code}/bob") as b,
    ):
        drain(a, "lobby_update")
        drain(b, "lobby_update")
        get_room_store().get(code).state = RoomState.PLAYING
        a.send_json({"type": "cursor", "payload": {"x": 0.5, "y": 0.25}})
        update = drain(b, "cursor_update")
        assert update["player"] == "alice"
        assert update["x"] == 0.5


def test_disconnect_updates_lobby(client):
    code = new_room(client)
    with client.websocket_connect(f"/ws/{code}/alice") as a:
        drain(a, "lobby_update")
        with client.websocket_connect(f"/ws/{code}/bob"):
            drain(a, "lobby_update")
        lobby = drain(a, "lobby_update")
        assert [p["name"] for p in lobby["room"]["players"]] == ["alice"]


@patch("app.rooms.theme_vote.build_game_from_candidates", return_value=("Chat", make_game((2, 4))))
def test_full_game_round(_mock, client):
    """Vote -> generation -> partie -> soumission -> classement."""
    code = new_room(client)
    with (
        client.websocket_connect(f"/ws/{code}/alice") as a,
        client.websocket_connect(f"/ws/{code}/bob") as b,
    ):
        drain(a, "lobby_update")
        drain(b, "lobby_update")

        a.send_json({"type": "start_vote", "payload": {"durationS": 120, "withItems": False}})
        drain(a, "theme_vote_start")
        drain(b, "theme_vote_start")

        a.send_json({"type": "submit_theme", "payload": {"theme": "Chat"}})
        b.send_json({"type": "submit_theme", "payload": {"theme": "Chat"}})

        start = drain(a, "game_start", limit=20)
        drain(b, "game_start", limit=20)
        assert start["theme"] == "Chat"
        assert start["durationS"] == 120
        assert len(start["game"]["paragraphs"]) == 6
        assert start["game"]["total_fakes"] == 2
        assert {p["name"] for p in start["players"]} == {"alice", "bob"}
        # Les reponses ne sont pas envoyees au demarrage.
        assert "fakes" not in start["game"] or start["game"]["fakes"] == []

        a.send_json({"type": "unlock_hint", "payload": {"targetIndex": 1}})
        hint = drain(a, "hint_unlocked", limit=20)
        assert hint["hint"]

        a.send_json({"type": "submit_answer", "payload": {"selection": [2, 4]}})
        b.send_json({"type": "submit_answer", "payload": {"selection": [1]}})

        end = drain(a, "game_end", limit=30)
        leaderboard = end["leaderboard"]
        assert leaderboard[0]["name"] == "alice"
        assert leaderboard[0]["breakdown"]["hits"] == 2
        assert leaderboard[0]["breakdown"]["hints_used"] == 1
        assert leaderboard[1]["breakdown"]["false_positives"] == 1
        assert len(end["solution"]) == 2
        assert get_room_store().get(code).state is RoomState.WAITING


@patch("app.rooms.theme_vote.build_game_from_candidates", return_value=("Chat", make_game((2, 4))))
def test_client_cannot_forge_its_score(_mock, client):
    """Regression §6.1 : hintPenalty / scoreStolen venaient du client."""
    code = new_room(client)
    with client.websocket_connect(f"/ws/{code}/alice") as a:
        drain(a, "lobby_update")
        a.send_json({"type": "start_vote", "payload": {"withItems": False}})
        drain(a, "theme_vote_start")
        a.send_json({"type": "submit_theme", "payload": {"theme": "Chat"}})
        drain(a, "game_start", limit=20)

        a.send_json({"type": "unlock_hint", "payload": {"targetIndex": 1}})
        drain(a, "hint_unlocked", limit=20)

        # Le client tente d'annuler sa penalite d'indice et de s'offrir un bonus.
        a.send_json(
            {
                "type": "submit_answer",
                "payload": {
                    "selection": [2, 4],
                    "hintsUsed": 0,
                    "hintPenalty": 0,
                    "scoreStolen": -100000,
                    "timeBonus": 999999,
                },
            }
        )
        end = drain(a, "game_end", limit=30)
        breakdown = end["leaderboard"][0]["breakdown"]
        assert breakdown["hints_used"] == 1
        assert breakdown["hint_penalty"] == 50
        assert breakdown["stolen_points"] == 0
        assert breakdown["total"] < 999999


@patch("app.rooms.theme_vote.build_game_from_candidates", return_value=("Chat", make_game((2,))))
def test_unsubmit_reopens_the_answer(_mock, client):
    code = new_room(client)
    with (
        client.websocket_connect(f"/ws/{code}/alice") as a,
        client.websocket_connect(f"/ws/{code}/bob") as b,
    ):
        drain(a, "lobby_update")
        drain(b, "lobby_update")
        a.send_json({"type": "start_vote", "payload": {"withItems": False}})
        drain(a, "theme_vote_start")
        a.send_json({"type": "submit_theme", "payload": {"theme": "Chat"}})
        b.send_json({"type": "submit_theme", "payload": {"theme": "Chat"}})
        drain(a, "game_start", limit=20)

        a.send_json({"type": "submit_answer", "payload": {"selection": [2]}})
        assert drain(a, "answer_ack", limit=20)["answered"] is True
        a.send_json({"type": "unsubmit_answer"})
        assert drain(a, "answer_ack", limit=20)["answered"] is False
        assert get_room_store().get(code).state is RoomState.PLAYING


@patch("app.rooms.theme_vote.build_game_from_candidates", return_value=("Chat", make_game((2, 4))))
def test_item_effects_are_applied_server_side(_mock, client):
    code = new_room(client)
    with (
        client.websocket_connect(f"/ws/{code}/alice") as a,
        client.websocket_connect(f"/ws/{code}/bob") as b,
    ):
        drain(a, "lobby_update")
        drain(b, "lobby_update")
        a.send_json({"type": "start_vote", "payload": {"withItems": False}})
        drain(a, "theme_vote_start")
        a.send_json({"type": "submit_theme", "payload": {"theme": "Chat"}})
        b.send_json({"type": "submit_theme", "payload": {"theme": "Chat"}})
        drain(a, "game_start", limit=20)
        drain(b, "game_start", limit=20)

        room = get_room_store().get(code)
        from app.rooms.models import ItemInstance

        room.players["alice"].items.append(ItemInstance("i1", "SCORE_STEAL"))
        a.send_json({"type": "use_item", "payload": {"instanceId": "i1", "targets": ["bob"]}})

        effect = drain(b, "item_effect", limit=20)
        assert effect["item_id"] == "SCORE_STEAL"
        assert effect["from"] == "alice"
        assert room.players["bob"].stolen_points == 50
        assert room.players["alice"].items == []


@patch("app.rooms.theme_vote.build_game_from_candidates", return_value=("Chat", make_game((2, 4))))
def test_scanner_reveals_a_real_fake(_mock, client):
    code = new_room(client)
    with client.websocket_connect(f"/ws/{code}/alice") as a:
        drain(a, "lobby_update")
        a.send_json({"type": "start_vote", "payload": {"withItems": False}})
        drain(a, "theme_vote_start")
        a.send_json({"type": "submit_theme", "payload": {"theme": "Chat"}})
        drain(a, "game_start", limit=20)

        room = get_room_store().get(code)
        from app.rooms.models import ItemInstance

        room.players["alice"].items.append(ItemInstance("s1", "SCANNER"))
        a.send_json({"type": "use_item", "payload": {"instanceId": "s1", "targets": []}})
        result = drain(a, "scanner_result", limit=20)
        assert result["paragraph_index"] in {2, 4}


@patch("app.rooms.theme_vote.build_game_from_candidates", side_effect=Exception("boom"))
def test_generation_failure_returns_to_lobby(_mock, client):
    code = new_room(client)
    with client.websocket_connect(f"/ws/{code}/alice") as a:
        drain(a, "lobby_update")
        a.send_json({"type": "start_vote"})
        drain(a, "theme_vote_start")
        a.send_json({"type": "submit_theme", "payload": {"theme": "zzz"}})
        # L'exception est capturee par le dispatcher, la salle reste utilisable.
        drain(a, "error", limit=20)
        assert get_room_store().get(code).state in (
            RoomState.WAITING,
            RoomState.THEME_VOTING,
            RoomState.GENERATING,
        )

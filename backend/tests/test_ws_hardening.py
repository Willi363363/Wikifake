"""Robustesse de l'endpoint WebSocket et des messages de salle."""
import os

if "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = "dummy-key-for-ci"

import pytest
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect

from main import app, rooms
from src.core.settings import MAX_CHAT_LENGTH, MAX_PLAYER_NAME_LENGTH
from src.realtime.room import InvalidPlayerName, validate_player_name

client = TestClient(app)


@pytest.fixture(autouse=True)
def clear_rooms():
    rooms.clear()
    yield
    rooms.clear()


def new_room() -> str:
    return client.post("/api/multiplayer/create").json()["room_code"]


def drain(ws, kind: str, limit: int = 10) -> dict:
    for _ in range(limit):
        message = ws.receive_json()
        if message["type"] == kind:
            return message
    raise AssertionError(f"message {kind!r} jamais reçu")


# --- validation du pseudo ----------------------------------------------------

@pytest.mark.parametrize("bad", ["", "   ", "x" * (MAX_PLAYER_NAME_LENGTH + 1), "bad<script>", "a\nb"])
def test_invalid_names_are_rejected(bad):
    with pytest.raises(InvalidPlayerName):
        validate_player_name(bad)


@pytest.mark.parametrize("good", ["alice", "Jean-Luc", "p_1", "Marie Curie", "élève.2"])
def test_valid_names_are_trimmed(good):
    assert validate_player_name(f"  {good}  ") == good


def test_socket_refuses_an_oversized_name():
    code = new_room()
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect(f"/ws/{code}/{'x' * 80}") as ws:
            refusal = ws.receive_json()
            assert refusal["code"] == "invalid_name"
            ws.receive_json()


def test_socket_refuses_a_duplicate_connected_name():
    """Un homonyme prenait le contrôle de la session du joueur déjà connecté."""
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as first:
        drain(first, "lobby_update")
        with pytest.raises(WebSocketDisconnect):
            with client.websocket_connect(f"/ws/{code}/alice") as second:
                refusal = second.receive_json()
                assert refusal["code"] == "name_taken"
                second.receive_json()
        # Le premier joueur est intact.
        assert rooms[code].players["alice"].connected is True


# --- trames et limites -------------------------------------------------------

def test_invalid_json_gets_an_error_not_a_crash():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as ws:
        drain(ws, "lobby_update")
        ws.send_text("{ceci n'est pas du json")
        assert drain(ws, "error")["code"] == "bad_json"
        # La connexion survit.
        ws.send_json({"type": "get_lobby"})
        drain(ws, "lobby_update")


def test_unknown_message_is_ignored():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as ws:
        drain(ws, "lobby_update")
        ws.send_json({"type": "n_importe_quoi"})
        ws.send_json({"type": "get_lobby"})
        drain(ws, "lobby_update")


def test_chat_is_truncated():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as ws:
        drain(ws, "lobby_update")
        ws.send_json({"type": "chat_message", "content": "x" * (MAX_CHAT_LENGTH + 500)})
        message = drain(ws, "chat_message")
        assert len(message["content"]) == MAX_CHAT_LENGTH


def test_empty_chat_is_dropped():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as ws:
        drain(ws, "lobby_update")
        ws.send_json({"type": "chat_message", "content": "   "})
        ws.send_json({"type": "get_lobby"})
        # Aucun chat_message ne doit précéder le lobby_update.
        assert ws.receive_json()["type"] == "lobby_update"


def test_cursor_is_rate_limited_and_clamped():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/p1") as first, \
         client.websocket_connect(f"/ws/{code}/p2") as second:
        drain(first, "lobby_update")
        drain(second, "lobby_update")
        rooms[code].state = "playing"

        first.send_json({"type": "cursor", "x": 5, "y": -3})
        update = drain(second, "cursor_update")
        assert update["x"] == 1.0   # borné
        assert update["y"] == 0.0

        # Envoi immédiat suivant : ignoré par la limitation de débit.
        first.send_json({"type": "cursor", "x": 0.9, "y": 0.9})
        first.send_json({"type": "get_lobby"})
        assert drain(second, "lobby_update")["type"] == "lobby_update"


# --- nettoyage ---------------------------------------------------------------

def test_room_is_forgotten_when_the_last_player_leaves():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as ws:
        drain(ws, "lobby_update")
        assert code in rooms
    assert code not in rooms


def test_room_survives_one_departure_among_several():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as first:
        drain(first, "lobby_update")
        with client.websocket_connect(f"/ws/{code}/bob"):
            drain(first, "lobby_update")
        drain(first, "lobby_update")
        assert list(rooms[code].players) == ["alice"]


# --- création de salle -------------------------------------------------------

def test_room_codes_are_unique():
    """Une collision écrasait silencieusement une salle en cours de partie."""
    codes = {new_room() for _ in range(40)}
    assert len(codes) == 40
    assert all(len(code) == 6 for code in codes)


def test_room_creation_is_capped():
    from src.api import rooms as rooms_api

    original = rooms_api.MAX_ROOMS
    rooms_api.MAX_ROOMS = 2
    try:
        new_room()
        new_room()
        assert client.post("/api/multiplayer/create").status_code == 503
    finally:
        rooms_api.MAX_ROOMS = original

"""Le rôle d'hôte est décidé et vérifié par le serveur.

Non-régression : `isHost` n'existait que côté client (`Lobby.jsx`). N'importe
quel joueur pouvait envoyer `force_start`, `force_pick`, `start_game` ou
changer la durée de la partie.
"""
import os

if "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = "dummy-key-for-ci"

import pytest
from fastapi.testclient import TestClient

from main import app, rooms

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


def test_first_player_is_host():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as ws:
        lobby = drain(ws, "lobby_update")
        assert lobby["players"][0]["isHost"] is True


def test_second_player_is_not_host():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice"), \
         client.websocket_connect(f"/ws/{code}/bob") as second:
        lobby = drain(second, "lobby_update")
        hosts = [p["name"] for p in lobby["players"] if p["isHost"]]
        assert hosts == ["alice"]


def test_host_role_moves_on_disconnect():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as first:
        drain(first, "lobby_update")
        with client.websocket_connect(f"/ws/{code}/bob") as second:
            drain(second, "lobby_update")
        # alice reste seule : elle garde le rôle
        assert rooms[code].players["alice"].is_host is True

    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice"):
        with client.websocket_connect(f"/ws/{code}/bob") as second:
            drain(second, "lobby_update")
            assert rooms[code].players["bob"].is_host is False
    # les deux partis, la salle disparaît
    assert code not in rooms


def test_host_departure_promotes_the_next_player():
    code = new_room()
    alice = client.websocket_connect(f"/ws/{code}/alice")
    alice.__enter__()
    drain(alice, "lobby_update")
    with client.websocket_connect(f"/ws/{code}/bob") as bob:
        drain(bob, "lobby_update")
        assert rooms[code].players["alice"].is_host is True
        alice.__exit__(None, None, None)
        drain(bob, "lobby_update")
        assert rooms[code].players["bob"].is_host is True


@pytest.mark.parametrize("command", ["force_start", "force_pick", "start_game"])
def test_guest_cannot_drive_the_room(command):
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as host, \
         client.websocket_connect(f"/ws/{code}/bob") as guest:
        drain(host, "lobby_update")
        drain(guest, "lobby_update")

        if command == "force_pick":
            rooms[code].state = "theme_voting"

        guest.send_json({"type": command, "category": "Chat"})
        error = drain(guest, "error")
        assert error["code"] == "not_host"
        # la salle n'a pas bougé
        assert rooms[code].state in ("waiting", "theme_voting")


def test_guest_cannot_change_round_options():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as host, \
         client.websocket_connect(f"/ws/{code}/bob") as guest:
        drain(host, "lobby_update")
        drain(guest, "lobby_update")

        guest.send_json({"type": "set_ready", "ready": True, "time_limit": 42, "with_items": False})
        drain(guest, "lobby_update")

        room = rooms[code]
        assert room.players["bob"].ready is True   # son propre état, autorisé
        assert room.time_limit != 42               # les options, non
        assert room.with_items is True


def test_host_can_change_round_options():
    code = new_room()
    with client.websocket_connect(f"/ws/{code}/alice") as host:
        drain(host, "lobby_update")
        host.send_json({"type": "set_ready", "ready": True, "time_limit": 90, "with_items": False})
        drain(host, "lobby_update")

        room = rooms[code]
        assert room.time_limit == 90
        assert room.with_items is False

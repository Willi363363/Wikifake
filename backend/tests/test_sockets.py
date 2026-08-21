import os
if "OPENAI_API_KEY" not in os.environ:
    os.environ["OPENAI_API_KEY"] = "sk-dummy-test-key-for-ci"

import pytest
from fastapi.testclient import TestClient
from fastapi import WebSocketDisconnect
from main import app, rooms
from unittest.mock import patch

client = TestClient(app)

@pytest.fixture(autouse=True)
def clear_rooms():
    rooms.clear()
    yield
    rooms.clear()

def test_websocket_join_room():
    res = client.post("/api/multiplayer/create")
    room_code = res.json()["room_code"]
    
    with client.websocket_connect(f"/ws/{room_code}/player1") as websocket:
        data = websocket.receive_json()
        assert data["type"] == "lobby_update"

def test_websocket_join_invalid_room():
    """Le serveur explique le refus avant de fermer, au lieu de raccrocher
    sans un mot."""
    from fastapi.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/INVALID/player1") as websocket:
            refusal = websocket.receive_json()
            assert refusal["type"] == "error"
            assert refusal["code"] == "room_not_found"
            websocket.receive_json()  # la fermeture arrive ensuite

@patch('src.core.agent.get_wikipedia_content')
def test_websocket_start_game_error(mock_wiki):
    mock_wiki.return_value = None  # simulate not found
    res = client.post("/api/multiplayer/create")
    room_code = res.json()["room_code"]
    
    with client.websocket_connect(f"/ws/{room_code}/player1") as websocket:
        websocket.receive_json() # lobby update
        
        websocket.send_json({"type": "start_game", "category": "FailCat"})
        data = websocket.receive_json()
        assert data["type"] == "error"
        assert "Mot-clé introuvable" in data["message"]

def test_websocket_cursor_broadcast():
    res = client.post("/api/multiplayer/create")
    room_code = res.json()["room_code"]
    
    with client.websocket_connect(f"/ws/{room_code}/p1") as ws1, \
         client.websocket_connect(f"/ws/{room_code}/p2") as ws2:
        
        # ws1 receives 2 lobby updates (p1 joins, p2 joins)
        ws1.receive_json()
        ws1.receive_json()
        
        # ws2 receives 1 lobby update (p2 joins)
        ws2.receive_json()
        
        rooms[room_code].state = "playing"
        
        # Le client envoie des fractions de viewport (clientX / innerWidth),
        # pas des pixels : le serveur les borne désormais à [0, 1].
        ws1.send_json({"type": "cursor", "x": 0.25, "y": 0.5})

        data = ws2.receive_json()
        assert data["type"] == "cursor_update"
        assert data["player"] == "p1"
        assert data["x"] == 0.25
        assert data["y"] == 0.5

def test_websocket_disconnect():
    res = client.post("/api/multiplayer/create")
    room_code = res.json()["room_code"]
    
    with client.websocket_connect(f"/ws/{room_code}/p1") as ws1:
        ws1.receive_json()
        assert len(rooms[room_code].players) == 1

    room = rooms.get(room_code)
    assert room is None or "p1" not in room.players
    assert room_code not in rooms

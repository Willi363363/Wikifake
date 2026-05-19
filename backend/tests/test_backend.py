import os
import pytest
from fastapi.testclient import TestClient

# We might not have a real .env during tests (e.g. in CI), so set dummy vars if needed
if "OPENAI_API_KEY" not in os.environ:
    os.environ["OPENAI_API_KEY"] = "sk-dummy-test-key-for-ci"

from main import app

client = TestClient(app)

def test_index_serves_html():
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "<title>Wikifake" in response.text

def test_create_multiplayer_room():
    response = client.post("/api/multiplayer/create")
    assert response.status_code == 200
    data = response.json()
    assert "room_code" in data
    assert len(data["room_code"]) == 6

def test_start_game_without_mocking():
    # Since we can't easily make a real API request to OpenAI without a valid key,
    # we'll just check if the endpoint is available and parses invalid requests.
    response = client.post("/api/game/start", json={})
    # Should be 422 Unprocessable Entity due to missing 'category' body field
    assert response.status_code == 422

def test_submit_answer_invalid_request():
    # Test that missing required fields result in a validation error
    response = client.post("/api/game/submit", json={})
    assert response.status_code == 422

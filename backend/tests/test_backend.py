import os
import re
import pytest
from fastapi.testclient import TestClient

# We might not have a real .env during tests (e.g. in CI), so set dummy vars if needed
if "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = "dummy-test-key-for-ci"
if "OPENAI_API_KEY" not in os.environ:
    os.environ["OPENAI_API_KEY"] = "sk-dummy-test-key-for-ci"

from main import app

client = TestClient(app)

def test_index_serves_html():
    """Le bundle construit est bien servi.

    On teste la présence d'un titre, pas son libellé exact : celui-ci est du
    texte de référencement, il changera. `frontend/src/__tests__/indexing.test.js`
    vérifie sa longueur et les balises de partage.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert re.search(r"<title>[^<]+</title>", response.text)
    assert 'id="root"' in response.text

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


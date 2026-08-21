import os
import pathlib
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

# Le job backend de la CI ne compile pas le frontend : `frontend/dist` est
# alors absent et le serveur rend une page d'aide. Les deux cas sont légitimes
# et testés séparément — l'ancien test passait par accident, la page d'aide
# contenant elle aussi « <title>Wikifake ».
_DIST_INDEX = (
    pathlib.Path(__file__).resolve().parent.parent.parent / "frontend" / "dist" / "index.html"
)


def test_index_always_serves_html():
    """Quel que soit l'état du build, la racine répond une page HTML titrée.

    Le libellé du titre n'est pas testé : c'est du texte de référencement, il
    changera. `frontend/src/__tests__/indexing.test.js` en vérifie la qualité.
    """
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert re.search(r"<title>[^<]+</title>", response.text)


@pytest.mark.skipif(_DIST_INDEX.exists(), reason="le frontend est construit")
def test_missing_build_is_explained():
    """Sans bundle, le serveur explique quoi faire au lieu d'un 404 muet."""
    body = client.get("/").text
    assert "npm" in body and "build" in body


@pytest.mark.skipif(not _DIST_INDEX.exists(), reason="le frontend n'est pas construit")
def test_built_bundle_is_served():
    """Avec bundle, c'est bien l'application qui est servie."""
    body = client.get("/").text
    assert 'id="root"' in body
    assert "/assets/" in body

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


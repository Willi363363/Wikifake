"""Sondes de vie et d'identité du déploiement."""
import os

if "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = "dummy-key-for-ci"

import importlib

from fastapi.testclient import TestClient

from main import app
from src.version import VERSION

client = TestClient(app)


def test_ping_stays_minimal():
    """Render et les répartiteurs de charge n'ont besoin que de ça."""
    assert client.get("/ping").json() == {"status": "alive"}


def test_health_reports_the_running_version():
    payload = client.get("/api/health").json()
    assert payload["status"] == "ok"
    assert payload["version"] == VERSION
    assert payload["model"]


def test_health_exposes_the_deployed_commit(monkeypatch):
    """C'est ce champ que la sonde de la CI compare à `github.sha` pour dire
    si la production sert bien le commit qui vient d'être poussé."""
    monkeypatch.setenv("RENDER_GIT_COMMIT", "0123456789abcdef")

    from src.api import health as health_module
    importlib.reload(health_module)
    try:
        payload = health_module.health()
        assert payload["commit"] == "0123456789abcdef"
        assert payload["commit_short"] == "0123456"
    finally:
        monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)
        importlib.reload(health_module)


def test_health_tolerates_a_local_run():
    """Hors plateforme, aucun commit n'est disponible : le champ est vide, pas
    absent — la sonde doit pouvoir le lire sans cas particulier."""
    payload = client.get("/api/health").json()
    assert "commit" in payload
    assert isinstance(payload["commit"], str)


def test_health_never_leaks_the_api_key():
    body = client.get("/api/health").text
    assert os.environ["GEMINI_API_KEY"] not in body
    # Seul un booléen indique si la génération peut fonctionner.
    assert client.get("/api/health").json()["llm_configured"] is True

"""Sondes de vie et d'identité du déploiement.

`/ping` répond simplement « je tourne ». `/api/health` dit **quelle version**
tourne : sans ça, impossible de savoir si un push sur `main` a bien été
redéployé autrement qu'en allant regarder le tableau de bord Render.
"""
import os

from fastapi import APIRouter

from src import article_cache, usage
from src.core.settings import MODEL_NAME
from src.version import VERSION

router = APIRouter()

# Render expose le commit déployé ; en local il n'existe pas.
_COMMIT = (
    os.getenv("RENDER_GIT_COMMIT")
    or os.getenv("GIT_COMMIT")
    or os.getenv("SOURCE_COMMIT")
    or ""
)


@router.get("/ping")
def ping():
    return {"status": "alive"}


@router.get("/api/health")
def health():
    """Identité du déploiement, consommée par la sonde de la CI.

    `commit` est vide en local : c'est normal, seule la plateforme le fournit.
    """
    return {
        "status": "ok",
        "version": VERSION,
        "commit": _COMMIT,
        "commit_short": _COMMIT[:7],
        "model": MODEL_NAME,
        # Dit si la génération d'articles peut fonctionner, sans divulguer la clé.
        "llm_configured": bool(os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")),
    }


@router.get("/api/usage")
def usage_report():
    """Consommation du modèle et efficacité du cache.

    Sert à répondre à une question chiffrée : combien coûte une partie ?
    Sans elle, impossible de savoir si un modèle publicitaire tient. Les
    compteurs sont en mémoire et repartent de zéro à chaque redémarrage.
    """
    return {"usage": usage.snapshot(), "cache": article_cache.stats()}

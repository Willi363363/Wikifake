"""Cache des articles falsifiés.

Chaque partie régénérait tout depuis zéro : deux joueurs tapant « Paris » à dix
secondes d'intervalle payaient deux fois le même travail, et attendaient dix
secondes chacun. Or un article falsifié est réutilisable indéfiniment — c'est
même souhaitable, puisque deux joueurs sur le même article ont des scores
comparables.

Le cache est en mémoire, borné, avec expiration. Il ne survit pas à un
redémarrage : c'est assumé pour l'instant, et l'interface (`get` / `put`) est
volontairement réduite à deux fonctions pour qu'un stockage partagé (Redis,
Postgres) se substitue en un seul fichier quand l'infrastructure suivra.

Le cache stocke PLUSIEURS articles par catégorie et en tire un au hasard : une
même recherche ne doit pas servir éternellement le même article.
"""
import random
import threading
import time
import unicodedata
from dataclasses import dataclass, field

from src.core.settings import (
    ARTICLE_CACHE_MAX_CATEGORIES,
    ARTICLE_CACHE_TTL,
    ARTICLE_CACHE_VARIANTS,
)
from src.log import get_logger

log = get_logger(__name__)


def normalize_category(raw: str) -> str:
    """Clé de cache : « PARIS », « paris » et « Paris » sont la même recherche."""
    text = unicodedata.normalize("NFKD", (raw or "").strip().casefold())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return " ".join(text.split())


@dataclass
class _Entry:
    game_data: dict
    created_at: float = field(default_factory=time.time)

    @property
    def expired(self) -> bool:
        return time.time() - self.created_at > ARTICLE_CACHE_TTL


_lock = threading.Lock()
# {catégorie normalisée: [entrées, la plus ancienne d'abord]}
_store: dict[str, list[_Entry]] = {}
# Ordre d'utilisation, pour évincer la catégorie la moins récemment servie.
_recent: list[str] = []


def _touch(key: str) -> None:
    if key in _recent:
        _recent.remove(key)
    _recent.append(key)
    while len(_recent) > ARTICLE_CACHE_MAX_CATEGORIES:
        evicted = _recent.pop(0)
        _store.pop(evicted, None)


def get(category: str, rng: random.Random | None = None) -> dict | None:
    """Un article déjà généré pour cette catégorie, ou None.

    Les entrées expirées sont retirées au passage : pas de tâche de fond.
    """
    key = normalize_category(category)
    if not key:
        return None

    with _lock:
        entries = [entry for entry in _store.get(key, []) if not entry.expired]
        if not entries:
            _store.pop(key, None)
            return None
        _store[key] = entries
        _touch(key)
        chosen = (rng or random).choice(entries)

    log.info("Cache: article servi pour %r (%d variante(s))", key, len(entries))
    # Copie défensive : l'appelant modifie le contenu du jeu en cours de partie.
    return _copy(chosen.game_data)


def put(category: str, game_data: dict) -> None:
    """Mémorise un article généré."""
    key = normalize_category(category)
    if not key or not game_data:
        return

    with _lock:
        entries = [entry for entry in _store.get(key, []) if not entry.expired]
        entries.append(_Entry(game_data=_copy(game_data)))
        # On garde les plus récentes.
        _store[key] = entries[-ARTICLE_CACHE_VARIANTS:]
        _touch(key)
    log.info("Cache: article mémorisé pour %r", key)


def _copy(game_data: dict) -> dict:
    """Copie assez profonde pour que deux parties ne partagent aucune liste."""
    return {
        **game_data,
        "paragraphs": list(game_data.get("paragraphs", [])),
        "positions": [dict(position) for position in game_data.get("positions", [])],
        "misinformations": [dict(m) for m in game_data.get("misinformations", [])],
    }


def stats() -> dict:
    with _lock:
        return {
            "categories": len(_store),
            "articles": sum(len(entries) for entries in _store.values()),
            "max_categories": ARTICLE_CACHE_MAX_CATEGORIES,
            "variants_per_category": ARTICLE_CACHE_VARIANTS,
            "ttl_seconds": ARTICLE_CACHE_TTL,
        }


def clear() -> None:
    with _lock:
        _store.clear()
        _recent.clear()

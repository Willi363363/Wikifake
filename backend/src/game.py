"""Accès au générateur de parties, avec cache.

`FakeNewsGame` mémorisait son résultat dans `self.current_game`, et une unique
instance était partagée par le mode solo et par toutes les salles : deux
parties lancées en parallèle s'écrasaient. La génération est donc sans état.

S'y ajoute un cache : chaque partie régénérait tout depuis zéro, ce qui coûtait
des appels au modèle et imposait dix secondes d'attente pour un travail déjà
fait dix secondes plus tôt. Voir `src/article_cache.py`.

`load_dotenv()` s'exécute à l'import pour que les clés d'API soient disponibles
avant le premier appel au modèle.
"""
from dotenv import load_dotenv

from src import article_cache, usage
from src.core.agent import FakeNewsGame
from src.core.settings import ARTICLE_CACHE_ENABLED
from src.log import get_logger

load_dotenv()

log = get_logger(__name__)

# Instance interne : elle ne porte que le pipeline de génération, son état
# résiduel n'est jamais lu. Ne pas exposer, ne pas partager.
_generator = FakeNewsGame()


def generate_game(category: str, use_cache: bool = True) -> dict | None:
    """Génère une partie pour cette catégorie, ou None si rien d'exploitable.

    Sert d'abord un article déjà généré pour la même catégorie quand il y en a
    un : le contenu reste pertinent, et deux joueurs sur le même article ont
    des scores comparables.

    **Bloquant** (HTTP + LLM) : appeler via `asyncio.to_thread` depuis du code
    asynchrone.
    """
    caching = use_cache and bool(ARTICLE_CACHE_ENABLED)

    if caching:
        cached = article_cache.get(category)
        if cached:
            usage.record_game(from_cache=True)
            return cached

    game_data = _generator.start_game(category)
    if not game_data:
        return None

    usage.record_game(from_cache=False)
    if caching:
        article_cache.put(category, game_data)
    return game_data

"""Accès au générateur de parties.

`FakeNewsGame` conservait son résultat dans `self.current_game`, et une unique
instance était partagée par le mode solo (REST) et par toutes les salles
multijoueur : deux parties lancées en parallèle s'écrasaient mutuellement.

La génération est désormais sans état — `generate_game()` retourne le contenu
sans rien mémoriser. Chaque appelant est responsable du stockage (une salle
garde le sien dans `room.game_data`).

`load_dotenv()` s'exécute à l'import pour que les clés d'API soient
disponibles avant le premier appel au modèle.
"""
from dotenv import load_dotenv

from src.core.agent import FakeNewsGame

load_dotenv()

# Instance interne : elle ne sert qu'à porter le pipeline de génération, son
# état résiduel n'est jamais lu. Ne pas exposer, ne pas partager.
_generator = FakeNewsGame()


def generate_game(category: str) -> dict | None:
    """Génère une partie pour cette catégorie, ou None si rien d'exploitable.

    **Bloquant** (HTTP + LLM) : appeler via `asyncio.to_thread` depuis du code
    asynchrone.
    """
    return _generator.start_game(category)

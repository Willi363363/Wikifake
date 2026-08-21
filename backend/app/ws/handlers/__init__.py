"""Handlers de messages WebSocket.

L'import de ce paquet suffit a enregistrer tous les handlers dans le
dispatcher. Pour ajouter une commande : creer/editer un module ici et
l'ajouter a la liste ci-dessous.
"""

from . import chat, gameplay, items, lobby, theme  # noqa: F401

__all__ = ["chat", "gameplay", "items", "lobby", "theme"]

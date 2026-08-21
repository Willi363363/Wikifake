"""Protocole WebSocket : SOURCE UNIQUE des noms de messages.

Cote frontend, le miroir de ce fichier est `frontend/src/net/protocol.js`.
Toute evolution du protocole se fait dans ces deux fichiers, nulle part ailleurs.
"""

from __future__ import annotations

from enum import Enum


class ClientMessage(str, Enum):
    """Messages client -> serveur."""

    GET_LOBBY = "get_lobby"
    SET_READY = "set_ready"
    SET_OPTIONS = "set_options"  # hote uniquement : duree, items
    START_VOTE = "start_vote"  # hote uniquement
    SUBMIT_THEME = "submit_theme"
    FORCE_PICK = "force_pick"  # hote uniquement
    SELECTION_UPDATE = "selection_update"
    SUBMIT_ANSWER = "submit_answer"
    UNSUBMIT_ANSWER = "unsubmit_answer"
    UNLOCK_HINT = "unlock_hint"
    USE_ITEM = "use_item"
    CURSOR = "cursor"
    CHAT_MESSAGE = "chat_message"


class ServerMessage(str, Enum):
    """Messages serveur -> client."""

    LOBBY_UPDATE = "lobby_update"
    ERROR = "error"
    THEME_VOTE_START = "theme_vote_start"
    THEME_VOTE_UPDATE = "theme_vote_update"
    THEME_SELECTED = "theme_selected"
    GAME_START = "game_start"
    GAME_END = "game_end"
    LIVE_SCORE = "live_score_update"
    CURSOR_UPDATE = "cursor_update"
    ITEMS_GRANTED = "items_granted"
    ITEM_EFFECT = "item_effect"
    ITEM_USED = "item_used"
    SCANNER_RESULT = "scanner_result"
    HINT_UNLOCKED = "hint_unlocked"
    ANSWER_ACK = "answer_ack"
    CHAT_MESSAGE = "chat_message"


def error(message: str, code: str = "generic") -> dict:
    return {"type": ServerMessage.ERROR.value, "message": message, "code": code}


def envelope(kind: ServerMessage, **payload) -> dict:
    """Construit un message sortant. Utilise partout pour eviter les
    chaines de caracteres en dur."""
    return {"type": kind.value, **payload}

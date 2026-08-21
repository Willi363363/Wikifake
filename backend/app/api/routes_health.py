"""Sonde de sante et introspection du protocole."""

from __future__ import annotations

from fastapi import APIRouter

from .. import __version__
from ..config import get_settings
from ..rooms.items import catalogue
from ..rooms.store import get_room_store
from ..ws.dispatcher import registered_types

router = APIRouter(tags=["health"])


@router.get("/ping")
def ping() -> dict:
    return {"status": "alive"}


@router.get("/api/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "version": __version__,
        "llm_configured": settings.llm_available,
        "rooms_active": len(get_room_store()),
        "items_loaded": len(catalogue()),
    }


@router.get("/api/config")
def public_config() -> dict:
    """Configuration publique consommee par le frontend au demarrage.

    Evite de dupliquer les constantes cote client (durees, bornes, items)."""
    settings = get_settings()
    return {
        "version": __version__,
        "llmConfigured": settings.llm_available,
        "duration": {
            "default": settings.rooms.default_duration_s,
            "min": settings.rooms.min_duration_s,
            "max": settings.rooms.max_duration_s,
        },
        "maxPlayers": settings.rooms.max_players,
        "maxNameLength": settings.rooms.max_name_length,
        "maxChatLength": settings.rooms.max_chat_length,
        "items": [item.to_dict() for item in catalogue()],
        "wsCommands": registered_types(),
    }

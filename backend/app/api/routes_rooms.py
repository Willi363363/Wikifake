"""Creation et consultation des salles."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..rooms.store import RoomError, get_room_store

router = APIRouter(prefix="/api/multiplayer", tags=["multiplayer"])


@router.post("/create")
def create_room() -> dict:
    try:
        room = get_room_store().create()
    except RoomError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    return {"room_code": room.code}


@router.get("/{room_code}")
def room_info(room_code: str) -> dict:
    """Permet au client de verifier qu'un code existe avant d'ouvrir le socket."""
    room = get_room_store().get(room_code.upper())
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Salle introuvable.")
    return room.to_lobby_dict()

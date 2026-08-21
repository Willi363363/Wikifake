"""Multiplayer room creation."""
import random
import string

from fastapi import APIRouter, HTTPException

from src.realtime.room import Room, rooms

router = APIRouter()

CODE_LENGTH = 6
CODE_ALPHABET = string.ascii_uppercase + string.digits

# Garde-fou mémoire : les salles vivent dans le process et ne sont oubliées
# qu'au départ de leur dernier joueur.
MAX_ROOMS = 200


def _new_code() -> str:
    """Code libre. Sans cette vérification, une collision — improbable mais
    possible — écrasait silencieusement une salle en cours de partie."""
    for _ in range(50):
        code = ''.join(random.choices(CODE_ALPHABET, k=CODE_LENGTH))
        if code not in rooms:
            return code
    raise HTTPException(status_code=503, detail="Impossible de créer une salle, réessayez.")


@router.post("/api/multiplayer/create")
def create_room():
    if len(rooms) >= MAX_ROOMS:
        raise HTTPException(status_code=503, detail="Trop de salles ouvertes, réessayez plus tard.")
    code = _new_code()
    rooms[code] = Room()
    return {"room_code": code}

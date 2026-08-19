"""Multiplayer room creation."""
import random
import string
from typing import Optional

from fastapi import APIRouter

from src.realtime.room import Room, rooms

from .schemas import CreateRoomRequest

router = APIRouter()


@router.post("/api/multiplayer/create")
def create_room(req: Optional[CreateRoomRequest] = None):
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    rooms[code] = Room()
    return {"room_code": code}

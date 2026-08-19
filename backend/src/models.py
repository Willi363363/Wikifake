"""Pydantic request models and domain dataclasses for WikiFake."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from fastapi import WebSocket
from pydantic import BaseModel

from .config import GAME_DURATION

# ── API Request Models ───────────────────────────────────────────────────


class StartGameRequest(BaseModel):
    """Request body for starting a solo game."""
    category: str


class SubmitAnswerRequest(BaseModel):
    """Request body for submitting paragraph indices."""
    paragraph_indices: list[int]


class FlagReportRequest(BaseModel):
    """Request body for submitting a flag report."""
    article_title: str
    article_url: str = ""
    flagged_claim: str
    quick_note: str = ""
    proposed_correction: str
    explanation: str = ""
    sources: list[str] = []
    player_id: str = "anonymous"
    room_code: str = ""


class CreateRoomRequest(BaseModel):
    """Empty request body for creating a multiplayer room."""


# ── Domain Dataclasses ───────────────────────────────────────────────────


@dataclass
class Player:
    """Represents a connected player in a multiplayer room."""
    socket: WebSocket
    score: int = 0
    answered: bool = False
    results: dict[str, Any] | None = None
    ready: bool = False
    color: str = ""
    connected: bool = True
    items: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Room:
    """Represents a multiplayer game room."""
    players: dict[str, Player] = field(default_factory=dict)
    game_data: dict[str, Any] | None = None
    state: str = "waiting"
    start_time: float = 0.0
    item_task: asyncio.Task[None] | None = None
    time_limit: int = GAME_DURATION
    voting_themes: dict[str, str] = field(default_factory=dict)
    picking_theme: bool = False
    with_items: bool = True
    between_rounds: bool = False

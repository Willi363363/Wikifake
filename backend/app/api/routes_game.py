"""Mode solo.

Le serveur garde la verite : il connait le depart du chrono, les indices
consommes et la solution. Le client n'envoie que sa selection.
"""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..game.answers import check_answers
from ..game.builder import GameBuildError, build_game
from ..game.llm import LLMUnavailableError
from ..game.sessions import SoloSession, get_solo_store
from ..logging_config import get_logger
from ..rooms.scoring import compute_score
from .rate_limit import rate_limiter

log = get_logger(__name__)

router = APIRouter(prefix="/api/game", tags=["solo"])


class StartGameRequest(BaseModel):
    category: str = Field(min_length=1, max_length=120)
    duration_s: int | None = Field(default=None, ge=10, le=3600)


class SubmitAnswerRequest(BaseModel):
    selection: list[int] = Field(default_factory=list, max_length=200)


class HintRequest(BaseModel):
    target_index: int = Field(ge=1, le=64)
    # 1 = indice textuel, 2 = localisation du paragraphe (plus couteux)
    level: int = Field(default=1, ge=1, le=2)


def _require_session(session_id: str) -> SoloSession:
    session = get_solo_store().get(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session introuvable ou expiree.",
        )
    return session


@router.post("/start", dependencies=[Depends(rate_limiter("game_start"))])
async def start_game(request: StartGameRequest) -> dict:
    """Genere une partie solo. La generation (HTTP + LLM) tourne dans un
    thread pour ne pas bloquer l'event loop."""
    try:
        game = await asyncio.to_thread(build_game, request.category)
    except LLMUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except GameBuildError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    session = get_solo_store().create(game, request.duration_s)
    return {
        "session_id": session.id,
        "durationS": session.duration_s,
        "game": game.to_public_dict(),
    }


@router.post("/{session_id}/hint")
def unlock_hint(session_id: str, request: HintRequest) -> dict:
    session = _require_session(session_id)
    solution = session.game.solution()
    if request.target_index > len(solution):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Indice inexistant.")

    fake = solution[request.target_index - 1]
    previous = session.hint_levels.get(request.target_index, 0)
    session.hint_levels[request.target_index] = max(previous, request.level)

    payload = {
        "target_index": request.target_index,
        "level": session.hint_levels[request.target_index],
        "hint": fake["hint"],
        "hints_used": session.hints_used,
    }
    if session.hint_levels[request.target_index] >= 2:
        payload["paragraph_index"] = fake["paragraph_index"]
    return payload


@router.post("/{session_id}/submit")
def submit_answer(session_id: str, request: SubmitAnswerRequest) -> dict:
    session = _require_session(session_id)
    max_index = len(session.game.paragraphs)
    selection = sorted({i for i in request.selection if 1 <= i <= max_index})

    check = check_answers(selection, session.game.fake_indices)
    breakdown = compute_score(
        check,
        seconds_remaining=session.seconds_remaining,
        hints_used=session.hints_used,
    )
    session.finished = True

    return {
        "check": check.to_dict(),
        "breakdown": breakdown.to_dict(),
        "score": breakdown.total,
        "solution": session.game.solution(),
    }

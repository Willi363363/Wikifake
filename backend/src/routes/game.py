"""Game API routes: solo game start and answer submission."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..core.agent import FakeNewsGame
from ..models import StartGameRequest, SubmitAnswerRequest

router = APIRouter(prefix="/api/game", tags=["game"])

# Module-level game instance for solo play
_game = FakeNewsGame()


@router.post("/start")
def start_game(req: StartGameRequest) -> dict:
    """Start a new solo game with the given category."""
    game_data = _game.start_game(req.category)
    if not game_data:
        raise HTTPException(
            status_code=400,
            detail="Mots-clés introuvables. Essayez une autre catégorie.",
        )
    return {
        "topic": game_data["topic"],
        "paragraphs": game_data.get("paragraphs", []),
        "misinformations": game_data.get("misinformations", []),
        "positions": game_data.get("positions", []),
        "total_fakes": game_data.get("total_false_statements", 0),
        "wikipedia_url": game_data.get("wikipedia_url", ""),
    }


@router.post("/submit")
def submit_answer(req: SubmitAnswerRequest) -> dict:
    """Submit paragraph indices and get verification results."""
    result = _game.submit_answers(req.paragraph_indices)
    return result

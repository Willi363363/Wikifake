"""Solo-game REST endpoints (start a round, submit answers)."""
from fastapi import APIRouter, HTTPException

from src.game import game

from .schemas import StartGameRequest, SubmitAnswerRequest

router = APIRouter()


@router.post("/api/game/start")
def start_game(req: StartGameRequest):
    game_data = game.start_game(req.category)
    if not game_data:
        raise HTTPException(status_code=400, detail="Mots-clés introuvables. Essayez une autre catégorie.")
    return {
        "topic": game_data["topic"],
        "paragraphs": game_data["paragraphs"],
        "misinformations": game_data["misinformations"],
        "positions": game_data["positions"],
        "total_fakes": game_data["total_false_statements"],
        "wikipedia_url": game_data.get("wikipedia_url", "")
    }


@router.post("/api/game/submit")
def submit_answer(req: SubmitAnswerRequest):
    result = game.submit_answers(req.paragraph_indices)
    return result

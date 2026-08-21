"""Mode solo.

Comme en multijoueur, le serveur détient la solution : le payload de départ
ne contient que l'article. Les indices sont facturés à l'appel, et la
correction n'est renvoyée qu'à la soumission.
"""
import random

from fastapi import APIRouter, HTTPException

from src import solo
from src.core.verification import check_answer
from src.game import generate_game
from src.realtime.room import GAME_DURATION
from src.scoring import HINT_COST, REVEAL_COST, breakdown, compute_score

from .schemas import SoloHintRequest, SoloScanRequest, SoloSubmitRequest, StartGameRequest

router = APIRouter()


def _require(session_id: str) -> solo.SoloSession:
    session = solo.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session introuvable ou expirée.")
    return session


@router.post("/api/game/start")
def start_game(req: StartGameRequest):
    game_data = generate_game(req.category)
    if not game_data:
        raise HTTPException(status_code=400, detail="Mots-clés introuvables. Essayez une autre catégorie.")

    time_limit = req.time_limit or GAME_DURATION
    session = solo.create(game_data, time_limit)
    return {
        "session_id": session.id,
        "time_limit": time_limit,
        "topic": game_data["topic"],
        "paragraphs": game_data["paragraphs"],
        "total_fakes": game_data["total_false_statements"],
        "wikipedia_url": game_data.get("wikipedia_url", ""),
        # Ni `positions` ni `misinformations` : la solution reste au serveur
        # jusqu'à la soumission.
    }


@router.post("/api/game/hint")
def unlock_hint(req: SoloHintRequest):
    session = _require(req.session_id)
    position = session.position(req.number)
    if position is None:
        raise HTTPException(status_code=404, detail="Indice inexistant.")

    granted = session.unlock(req.number, 2 if req.level >= 2 else 1)
    payload = {
        "number": req.number,
        "level": granted,
        "hint": position["hint"],
        "cost": REVEAL_COST if granted >= 2 else HINT_COST,
        "hint_penalty": session.hint_penalty,
    }
    if granted >= 2:
        payload["truth"] = position["explanation"]
        payload["paragraph_index"] = position["paragraph_index"]
    return payload


@router.post("/api/game/scan")
def scan(req: SoloScanRequest):
    """Item Détecteur : désigne un paragraphe falsifié encore non repéré."""
    session = _require(req.session_id)
    marked = set(req.marked)
    candidates = [
        position["paragraph_index"]
        for position in session.positions
        if position["paragraph_index"] not in marked
        and position["paragraph_index"] not in session.scanned
    ]
    if not candidates:
        return {"paragraph_index": None}

    chosen = random.choice(candidates)
    session.scanned.append(chosen)
    return {"paragraph_index": chosen}


@router.post("/api/game/submit")
def submit_answer(req: SoloSubmitRequest):
    """Corrige la partie et livre enfin la solution."""
    session = _require(req.session_id)

    result = check_answer(req.answers, session.positions)
    tp = len(result["correct_found"])
    fp = len(result["false_positives"])

    score, time_bonus = compute_score(
        tp, fp, session.hint_penalty, 0, session.time_limit, session.elapsed
    )
    session.finished = True

    return {
        "score": score,
        "breakdown": breakdown(
            tp=tp,
            fp=fp,
            hints_used=session.hints_used,
            hint_penalty=session.hint_penalty,
            score_stolen=0,
            time_bonus=time_bonus,
        ),
        "check": result,
        "positions": session.positions,
    }

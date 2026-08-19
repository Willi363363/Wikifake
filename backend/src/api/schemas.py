"""Pydantic request models for the REST API."""
from typing import List, Optional

from pydantic import BaseModel


class StartGameRequest(BaseModel):
    category: str


class SubmitAnswerRequest(BaseModel):
    paragraph_indices: list[int]


class FlagReportRequest(BaseModel):
    article_title: str
    article_url: str = ""
    flagged_claim: str
    quick_note: str = ""
    proposed_correction: str
    explanation: str = ""
    sources: List[str] = []
    player_id: str = "anonymous"
    room_code: str = ""


class CreateRoomRequest(BaseModel):
    """Empty on purpose: room creation takes no options yet, but keeping the
    model preserves the (optional) JSON body the old endpoint accepted."""
    pass

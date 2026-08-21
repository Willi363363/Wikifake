"""Pydantic request models for the REST API."""
from typing import List, Optional

from pydantic import BaseModel


class StartGameRequest(BaseModel):
    category: str
    time_limit: Optional[int] = None


class SoloHintRequest(BaseModel):
    """Achat d'un indice en solo. Le coût est appliqué par le serveur."""
    session_id: str
    number: int
    level: int = 1


class SoloScanRequest(BaseModel):
    """Item Détecteur : le serveur choisit un paragraphe encore non trouvé.

    `marked` sert uniquement à éviter de désigner un paragraphe que le joueur
    a déjà coché ; le falsifier ne rapporte rien.
    """
    session_id: str
    marked: list[int] = []


class SoloSubmitRequest(BaseModel):
    session_id: str
    answers: list[int] = []


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


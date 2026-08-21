"""Modeles de signalement."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

VERDICT_LABELS = {
    "likely_valid": "Correction probablement valide",
    "uncertain": "Incertain — revision humaine recommandee",
    "unsupported": "Non etaye — faible confiance",
}

STATUS_BY_RECOMMENDATION = {
    "approve_for_review": "pending_human_review",
    "reject": "rejected_by_ai",
}


class FlagReport(BaseModel):
    """Payload entrant (valide par FastAPI)."""

    article_title: str = Field(default="", max_length=300)
    article_url: str = Field(default="", max_length=1000)
    flagged_claim: str = Field(min_length=3, max_length=4000)
    quick_note: str = Field(default="", max_length=1000)
    proposed_correction: str = Field(min_length=1, max_length=4000)
    explanation: str = Field(default="", max_length=4000)
    sources: list[str] = Field(default_factory=list, max_length=10)
    player_id: str = Field(default="anonymous", max_length=64)
    room_code: str = Field(default="", max_length=16)


class FlagRecord(BaseModel):
    """Ligne persistee dans `data/complaints.jsonl`."""

    id: str
    timestamp: str
    status: str
    report: FlagReport
    wiki_context_used: bool
    verification: dict[str, Any]

    @staticmethod
    def now_iso() -> str:
        return datetime.now(UTC).isoformat()

    def to_response(self) -> dict:
        return {
            "id": self.id,
            "status": self.status,
            "verification": self.verification,
            "verdict_label": VERDICT_LABELS.get(
                str(self.verification.get("verdict")), VERDICT_LABELS["uncertain"]
            ),
        }

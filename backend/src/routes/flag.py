"""Flag report API route."""
from __future__ import annotations

from fastapi import APIRouter

from ..core.flag_verifier import verify_and_save
from ..models import FlagReportRequest

router = APIRouter(tags=["flag"])


@router.post("/api/flag-report")
async def submit_flag_report(req: FlagReportRequest) -> dict:
    """Submit a flag report for AI-powered fact-checking."""
    record = await verify_and_save(req.model_dump())
    return {
        "id": record["id"],
        "status": record["status"],
        "verification": record["verification"],
    }

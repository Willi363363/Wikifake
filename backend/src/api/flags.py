"""Flag-for-review endpoint: players report real factual errors in articles."""
from fastapi import APIRouter

from src.core.flag_verifier import verify_and_save

from .schemas import FlagReportRequest

router = APIRouter()


@router.post("/api/flag-report")
async def submit_flag_report(req: FlagReportRequest):
    record = await verify_and_save(req.model_dump())
    return {
        "id": record["id"],
        "status": record["status"],
        "verification": record["verification"],
    }

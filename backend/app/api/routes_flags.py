"""Signalement d'une erreur factuelle reelle."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ..flags.models import FlagReport
from ..flags.service import verify_and_store
from .rate_limit import rate_limiter

router = APIRouter(prefix="/api", tags=["flags"])


@router.post("/flag-report", dependencies=[Depends(rate_limiter("flag_report"))])
async def submit_flag_report(report: FlagReport) -> dict:
    record = await verify_and_store(report)
    return record.to_response()

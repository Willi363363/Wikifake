"""Pipeline complet d'un signalement : contexte -> verification -> stockage."""

from __future__ import annotations

import asyncio
import secrets

from ..logging_config import get_logger
from . import repository, verifier
from .models import STATUS_BY_RECOMMENDATION, FlagRecord, FlagReport

log = get_logger(__name__)


async def verify_and_store(report: FlagReport) -> FlagRecord:
    """Les deux etapes bloquantes (Wikipedia puis LLM) tournent dans un
    thread : l'event loop reste libre pour les WebSockets."""
    wiki_context = await asyncio.to_thread(
        verifier.fetch_context, report.article_title, report.flagged_claim
    )
    verification = await asyncio.to_thread(verifier.verify, report, wiki_context)

    record = FlagRecord(
        id=f"flag_{secrets.token_hex(8)}",
        timestamp=FlagRecord.now_iso(),
        status=STATUS_BY_RECOMMENDATION.get(str(verification.get("recommendation")), "ai_reviewed"),
        report=report,
        wiki_context_used=bool(wiki_context),
        verification=verification,
    )
    await asyncio.to_thread(repository.append, record)
    log.info("Signalement %s enregistre (%s)", record.id, record.status)
    return record

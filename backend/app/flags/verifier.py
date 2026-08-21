"""Verification LLM d'un signalement, avec contexte Wikipedia."""

from __future__ import annotations

import wikipedia

from ..config import get_settings
from ..game.llm import LLMUnavailableError, run_json_chain
from ..game.prompts import FLAG_VERIFIER
from ..logging_config import get_logger
from .models import FlagReport

log = get_logger(__name__)

MAX_CONTEXT_CHARS = 3000

FALLBACK_VERDICT = {
    "verdict": "uncertain",
    "confidence": 0,
    "reasoning": "La verification automatique a echoue. Une revision manuelle est requise.",
    "sources_found": [],
    "recommendation": "needs_more_info",
}


def fetch_context(article_title: str, flagged_claim: str) -> str:
    """Recupere du texte Wikipedia comme reference. **Bloquant.**"""
    settings = get_settings().game
    wikipedia.set_lang(settings.language)
    wikipedia.set_user_agent(settings.user_agent)

    for query, auto_suggest in ((article_title, False), (flagged_claim[:120], True)):
        if not query.strip():
            continue
        try:
            page = wikipedia.page(query, auto_suggest=auto_suggest)
            return page.content[:MAX_CONTEXT_CHARS]
        except Exception as exc:
            log.debug("Contexte Wikipedia indisponible pour %r: %s", query, exc)
    return ""


def verify(report: FlagReport, wiki_context: str) -> dict:
    """Appelle le LLM et normalise le verdict. **Bloquant.**"""
    try:
        payload = run_json_chain(
            FLAG_VERIFIER,
            {
                "article_title": report.article_title,
                "flagged_claim": report.flagged_claim,
                "proposed_correction": report.proposed_correction,
                "explanation": report.explanation or "Aucune",
                "player_sources": "\n".join(report.sources) or "Aucune",
                "wiki_context": wiki_context or "Non disponible",
            },
            temperature=0.1,
        )
    except LLMUnavailableError as exc:
        log.warning("Verification impossible: %s", exc)
        return dict(FALLBACK_VERDICT)

    if not payload:
        return dict(FALLBACK_VERDICT)

    verdict = str(payload.get("verdict", "uncertain"))
    if verdict not in {"likely_valid", "uncertain", "unsupported"}:
        verdict = "uncertain"
    recommendation = str(payload.get("recommendation", "needs_more_info"))
    if recommendation not in {"approve_for_review", "needs_more_info", "reject"}:
        recommendation = "needs_more_info"
    try:
        confidence = max(0, min(100, int(payload.get("confidence", 0))))
    except (TypeError, ValueError):
        confidence = 0
    sources = payload.get("sources_found")
    if not isinstance(sources, list):
        sources = []

    return {
        "verdict": verdict,
        "confidence": confidence,
        "reasoning": str(payload.get("reasoning", "")).strip() or FALLBACK_VERDICT["reasoning"],
        "sources_found": [str(s) for s in sources[:3]],
        "recommendation": recommendation,
    }

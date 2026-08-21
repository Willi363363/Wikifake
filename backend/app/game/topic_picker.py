"""Choix d'un sujet d'article a partir d'une categorie libre."""

from __future__ import annotations

from ..config import get_settings
from ..logging_config import get_logger
from .llm import run_text_chain
from .prompts import TOPIC_PICKER

log = get_logger(__name__)


def pick_topic(category: str, excluded: list[str] | None = None) -> str:
    """Demande au LLM un titre d'article Wikipedia pour cette categorie.

    En cas d'echec du modele, on retombe sur la categorie elle-meme : c'est
    souvent deja un titre d'article valide, ce qui evite de bloquer la partie.
    """
    settings = get_settings()
    excluded = excluded or []
    exclusions = (
        f"- N'utilise PAS ces sujets deja essayes : {', '.join(excluded)}." if excluded else ""
    )
    try:
        topic = run_text_chain(
            TOPIC_PICKER,
            {
                "category": category,
                "language": settings.game.language,
                "exclusions": exclusions,
            },
            temperature=0.9,
        )
    except Exception as exc:
        log.warning("Choix de sujet indisponible (%s), repli sur la categorie", exc)
        return category.strip()

    topic = topic.strip().strip('"').strip("'")
    return topic or category.strip()

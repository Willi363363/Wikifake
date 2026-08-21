"""Injection de fausses informations dans des paragraphes.

Corrige par rapport a l'ancien `misinformation.py` : l'index du paragraphe
falsifie est **conserve et retourne**, il n'est plus retire au profit d'un
tirage aleatoire dans `agent.py` (bug qui faisait noter le joueur sur un
paragraphe different de celui reellement modifie).
"""

from __future__ import annotations

import random

from ..config import get_settings
from ..logging_config import get_logger
from .llm import run_json_chain
from .models import Fake
from .prompts import FALSIFIER

log = get_logger(__name__)

# On tronque le paragraphe envoye au modele pour borner le cout du prompt.
_MAX_PROMPT_CHARS = 1200

DEFAULT_EXPLANATION = "Cette information a ete alteree par rapport a la source."
DEFAULT_HINT = "Verifiez cette information."


def eligible_indices(paragraphs: list[str], min_chars: int) -> list[int]:
    """Indices **1-base** des paragraphes assez longs pour etre falsifies."""
    return [
        index for index, text in enumerate(paragraphs, start=1) if len(text.strip()) >= min_chars
    ]


def falsify_paragraph(original: str, topic: str) -> dict | None:
    """Retourne {swapped_text, explanation, hint} ou None si le LLM echoue."""
    payload = run_json_chain(
        FALSIFIER,
        {"topic": topic, "original": original[:_MAX_PROMPT_CHARS]},
        temperature=0.7,
    )
    if not payload:
        return None
    swapped = str(payload.get("swapped_text") or "").strip()
    if not swapped or swapped == original.strip():
        log.warning("Le modele n'a pas modifie le paragraphe, on l'ignore")
        return None
    return {
        "swapped_text": swapped,
        "explanation": str(payload.get("explanation") or DEFAULT_EXPLANATION).strip(),
        "hint": str(payload.get("hint") or DEFAULT_HINT).strip(),
    }


def inject_fakes(
    paragraphs: list[str],
    topic: str,
    count: int | None = None,
    rng: random.Random | None = None,
) -> list[Fake]:
    """Choisit des paragraphes eligibles et y injecte une fausse information.

    Retourne la liste des `Fake`, chacun portant l'index 1-base du paragraphe
    qu'il remplace. Les paragraphes que le LLM n'a pas su modifier sont
    simplement absents du resultat.
    """
    settings = get_settings().game
    rng = rng or random.Random()
    wanted = settings.fakes_per_article if count is None else count

    candidates = eligible_indices(paragraphs, settings.min_paragraph_chars)
    if not candidates:
        log.warning("Aucun paragraphe eligible (min %d caracteres)", settings.min_paragraph_chars)
        return []

    selected = rng.sample(candidates, min(wanted, len(candidates)))
    selected.sort()

    fakes: list[Fake] = []
    for index in selected:
        original = paragraphs[index - 1]
        result = falsify_paragraph(original, topic)
        if result is None:
            continue
        fakes.append(
            Fake(
                paragraph_index=index,
                original_text=original,
                text=result["swapped_text"],
                explanation=result["explanation"],
                hint=result["hint"],
            )
        )
    log.info("%d/%d fausses informations injectees", len(fakes), len(selected))
    return fakes

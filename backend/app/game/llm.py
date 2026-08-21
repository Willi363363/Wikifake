"""Acces au LLM : fabrique de client + extraction JSON robuste.

Centralise ici pour que le parsing des reponses JSON ne soit plus
reimplemente differemment dans chaque module (c'etait le cas dans
misinformation.py et flag_verifier.py).
"""

from __future__ import annotations

import json
import re
from typing import Any

from ..config import get_settings
from ..logging_config import get_logger

log = get_logger(__name__)

_FENCE_RE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$", re.IGNORECASE)


class LLMUnavailableError(RuntimeError):
    """Aucune cle API configuree : on ne peut pas generer de partie."""


def build_chat_model(temperature: float = 0.7):
    """Retourne un ChatOpenAI configure. Import paresseux : le module reste
    importable (et testable) sans langchain installe."""
    settings = get_settings()
    if not settings.llm_available:
        raise LLMUnavailableError(
            "OPENAI_API_KEY absente : impossible de contacter le modele. "
            "Renseignez-la dans le fichier .env."
        )
    from langchain_openai import ChatOpenAI

    return ChatOpenAI(model=settings.game.model_name, temperature=temperature)


def run_text_chain(messages, variables: dict[str, Any], temperature: float = 0.7) -> str:
    """Execute un prompt et renvoie du texte brut."""
    from langchain_core.output_parsers import StrOutputParser
    from langchain_core.prompts import ChatPromptTemplate

    prompt = ChatPromptTemplate.from_messages(messages)
    chain = prompt | build_chat_model(temperature) | StrOutputParser()
    return str(chain.invoke(variables)).strip()


def strip_code_fences(raw: str) -> str:
    """Retire les balises markdown que les modeles ajoutent souvent."""
    text = raw.strip()
    if "```" not in text:
        return text
    # Retire une eventuelle ouverture puis une eventuelle fermeture.
    text = re.sub(r"^\s*```(?:json)?\s*", "", text, count=1, flags=re.IGNORECASE)
    text = re.sub(r"\s*```\s*$", "", text, count=1)
    return text.strip()


def parse_json_object(raw: str) -> dict | None:
    """Extrait le premier objet JSON d'une reponse LLM, ou None."""
    text = strip_code_fences(raw)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # Repli : on isole le plus grand bloc entre accolades.
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            log.warning("Reponse LLM non JSON: %s", text[:160])
            return None
        try:
            parsed = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            log.warning("Reponse LLM non parsable: %s", text[:160])
            return None
    return parsed if isinstance(parsed, dict) else None


def run_json_chain(messages, variables: dict[str, Any], temperature: float = 0.3) -> dict | None:
    """Execute un prompt et renvoie un dict, ou None si echec."""
    try:
        raw = run_text_chain(messages, variables, temperature)
    except LLMUnavailableError:
        raise
    except Exception as exc:  # erreur reseau / quota / modele
        log.warning("Appel LLM echoue: %s", exc)
        return None
    return parse_json_object(raw)

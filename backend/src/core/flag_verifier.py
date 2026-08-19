import asyncio
import datetime
import json
import pathlib

import wikipedia
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI

from .settings import MODEL_NAME

DATA_DIR = pathlib.Path(__file__).parent.parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
COMPLAINTS_FILE = DATA_DIR / "complaints.jsonl"

VERDICT_LABELS = {
    "likely_valid": "Correction probablement valide",
    "uncertain": "Incertain — révision humaine recommandée",
    "unsupported": "Non étayé — faible confiance",
}


def _fetch_wikipedia_context(article_title: str, flagged_claim: str) -> str:
    """Fetch Wikipedia content for the article title, falling back to a claim-based search."""
    try:
        try:
            page = wikipedia.page(article_title, auto_suggest=False)
            return page.content[:3000]
        except wikipedia.exceptions.PageError:
            results = wikipedia.search(article_title or flagged_claim, results=3)
            if not results:
                return ""
            page = wikipedia.page(results[0])
            return page.content[:3000]
    except Exception as e:  # noqa: BLE001
        print(f"[FlagVerifier] Wikipedia lookup failed: {e}")
        return ""


def _run_llm_verification(report: dict, wiki_context: str) -> dict:
    llm = ChatOpenAI(model=MODEL_NAME, temperature=0.1)

    prompt = ChatPromptTemplate.from_messages([
        ("system", """
Tu es un fact-checker expert. Un joueur du jeu WikiFake a signalé ce qu'il pense être une vraie
erreur factuelle dans un article généré (distinct des fausses informations délibérément injectées
par le jeu).

Ton rôle :
1. Analyser l'affirmation signalée et la correction proposée par le joueur.
2. Utiliser le contexte Wikipedia fourni comme référence factuelle principale.
3. Évaluer si la correction proposée semble valide, incertaine ou non étayée.
4. Produire un verdict structuré en JSON.

Retourne UNIQUEMENT un objet JSON valide avec exactement ces clés :
- "verdict"        : "likely_valid" | "uncertain" | "unsupported"
- "confidence"     : integer 0-100
- "reasoning"      : string (2-3 phrases max, en français)
- "sources_found"  : list<string> (extraits pertinents du contexte Wikipedia, max 3)
- "recommendation" : "approve_for_review" | "needs_more_info" | "reject"
"""),
        ("human", """
Titre de l'article : {article_title}

Affirmation signalée comme potentiellement fausse :
"{flagged_claim}"

Correction proposée par le joueur :
"{proposed_correction}"

Explication du joueur (optionnel) :
"{explanation}"

Sources citées par le joueur (optionnel) :
{player_sources}

Contexte Wikipedia :
{wiki_context}

Analyse et retourne ton verdict JSON.
"""),
    ])

    chain = prompt | llm | StrOutputParser()
    try:
        raw = chain.invoke({
            "article_title": report.get("article_title", ""),
            "flagged_claim": report.get("flagged_claim", ""),
            "proposed_correction": report.get("proposed_correction", ""),
            "explanation": report.get("explanation", ""),
            "player_sources": "\n".join(report.get("sources", [])) or "Aucune",
            "wiki_context": wiki_context or "Non disponible",
        }).strip()

        raw = raw.removeprefix("```json")
        raw = raw.removeprefix("```")
        raw = raw.removesuffix("```")

        return json.loads(raw.strip())
    except Exception as e:  # noqa: BLE001
        print(f"[FlagVerifier] LLM verification error: {e}")
        return {
            "verdict": "uncertain",
            "confidence": 0,
            "reasoning": "La vérification automatique a échoué. Une révision manuelle est requise.",
            "sources_found": [],
            "recommendation": "needs_more_info",
        }


async def verify_and_save(report: dict) -> dict:
    """
    Full pipeline: fetch context → LLM verify → save to JSONL → return result.
    report must contain: article_title, article_url, flagged_claim,
    proposed_correction, explanation, sources, player_id, room_code, quick_note.
    """
    # Run blocking I/O off the event loop
    wiki_context = await asyncio.to_thread(
        _fetch_wikipedia_context,
        report.get("article_title", ""),
        report.get("flagged_claim", ""),
    )

    verification = await asyncio.to_thread(_run_llm_verification, report, wiki_context)

    record = {
        "id": f"flag_{int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": "ai_reviewed",
        "article_title": report.get("article_title", ""),
        "article_url": report.get("article_url", ""),
        "room_code": report.get("room_code", ""),
        "player_id": report.get("player_id", "anonymous"),
        "flagged_claim": report.get("flagged_claim", ""),
        "quick_note": report.get("quick_note", ""),
        "proposed_correction": report.get("proposed_correction", ""),
        "explanation": report.get("explanation", ""),
        "sources": report.get("sources", []),
        "wiki_context_used": bool(wiki_context),
        "verification": verification,
    }

    # Promote status based on verdict
    if verification.get("recommendation") == "approve_for_review":
        record["status"] = "pending_human_review"
    elif verification.get("recommendation") == "reject":
        record["status"] = "rejected_by_ai"

    await asyncio.to_thread(_append_record, record)
    return record


def _append_record(record: dict) -> None:
    with open(COMPLAINTS_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

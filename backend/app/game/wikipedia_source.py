"""Recuperation d'un article Wikipedia exploitable.

Corrige par rapport a l'ancien `scraper.py` :
- boucle bornee (`max_topic_attempts`) au lieu de `while True`
- plus de doublons de paragraphes (l'ancien concatenait deux `find_all`)
- ne renvoie plus la soup ni le HTML : aucun effet de bord partage,
  aucune donnee lourde inutile transportee
- timeouts HTTP explicites et logging structure
"""

from __future__ import annotations

import re
import time

import requests
import wikipedia
from bs4 import BeautifulSoup

from ..config import get_settings
from ..logging_config import get_logger
from .models import SourceArticle
from .topic_picker import pick_topic

log = get_logger(__name__)

_WHITESPACE_RE = re.compile(r"\s+")
_SPACE_BEFORE_PUNCT_RE = re.compile(r"\s+([.,;:!?%)\]])")
_CITATION_RE = re.compile(r"\[\s*(?:\d+|[a-z]|note\s*\d+|réf\.?[^\]]*)\s*\]", re.IGNORECASE)

_CONTENT_SELECTORS = ("#mw-content-text", "#bodyContent", "#content")
_SKIP_PARENT_CLASSES = {
    "infobox",
    "navbox",
    "thumbcaption",
    "reflist",
    "hatnote",
    "mw-empty-elt",
    "bandeau-container",
    "homonymie",
}


class ArticleNotFoundError(RuntimeError):
    """Aucun article exploitable trouve apres toutes les tentatives."""


def _configure_wikipedia() -> None:
    settings = get_settings()
    wikipedia.set_lang(settings.game.language)
    wikipedia.set_user_agent(settings.game.user_agent)


def clean_paragraph_text(raw: str) -> str:
    """Normalise le texte d'un paragraphe (espaces, ponctuation, refs)."""
    text = _CITATION_RE.sub("", raw)
    text = text.replace("\xa0", " ")
    text = _WHITESPACE_RE.sub(" ", text)
    text = _SPACE_BEFORE_PUNCT_RE.sub(r"\1", text)
    return text.strip()


def _is_relevant(tag) -> bool:
    """Ecarte les paragraphes de bandeaux, infobox, legendes, notes."""
    for parent in tag.parents:
        classes = parent.get("class") or []
        if any(cls in _SKIP_PARENT_CLASSES for cls in classes):
            return False
        if parent.name == "table":
            return False
    return True


def extract_paragraphs(html: str, min_chars: int) -> list[str]:
    """Extrait les paragraphes de contenu d'une page Wikipedia.

    Chaque `<p>` est visite UNE SEULE FOIS (bug historique : l'ancien code
    concatenait `find_all('p', recursive=False)` et `find_all('p')`, ce qui
    dupliquait tous les paragraphes de premier niveau et desalignait les
    indices).
    """
    soup = BeautifulSoup(html, "html.parser")
    container = None
    for selector in _CONTENT_SELECTORS:
        container = soup.select_one(selector)
        if container is not None:
            break
    if container is None:
        container = soup

    paragraphs: list[str] = []
    seen: set[str] = set()
    for tag in container.find_all("p"):
        if not _is_relevant(tag):
            continue
        text = clean_paragraph_text(tag.get_text(" ", strip=True))
        if len(text) < min_chars:
            continue
        # Wikipedia sert parfois deux fois le meme paragraphe (variantes
        # mobile/desktop). On dedoublonne sur le texte complet pour ne jamais
        # ecarter deux paragraphes distincts qui commencent pareil.
        if text in seen:
            continue
        seen.add(text)
        paragraphs.append(text)
    return paragraphs


def _fetch_page_html(url: str) -> str:
    settings = get_settings()
    response = requests.get(
        url,
        headers={"User-Agent": settings.game.user_agent},
        timeout=settings.game.http_timeout_s,
    )
    response.raise_for_status()
    return response.text


def _resolve_page(topic: str, excluded: set[str]):
    """Retourne un objet page wikipedia pour ce sujet, ou None."""
    try:
        candidates = wikipedia.search(topic, results=3)
    except Exception as exc:
        log.warning("Recherche Wikipedia impossible pour %r: %s", topic, exc)
        return None
    if not candidates:
        return None
    for title in candidates:
        if title in excluded:
            continue
        try:
            return wikipedia.page(title, auto_suggest=False)
        except Exception as exc:
            log.debug("Page %r inaccessible: %s", title, exc)
            excluded.add(title)
    return None


def fetch_article(category: str) -> SourceArticle:
    """Trouve un article Wikipedia assez riche pour faire une partie.

    Leve `ArticleNotFoundError` apres `max_topic_attempts` essais infructueux
    au lieu de boucler indefiniment (et de bruler des credits LLM).
    """
    settings = get_settings().game
    _configure_wikipedia()

    excluded: set[str] = set()
    last_reason = "aucune tentative"

    for attempt in range(1, settings.max_topic_attempts + 1):
        topic = pick_topic(category, sorted(excluded))
        log.info("Tentative %d/%d — sujet propose: %r", attempt, settings.max_topic_attempts, topic)

        page = _resolve_page(topic, excluded)
        if page is None:
            last_reason = f"aucune page trouvee pour {topic!r}"
            excluded.add(topic)
            time.sleep(settings.retry_backoff_s)
            continue

        try:
            html = _fetch_page_html(page.url)
        except requests.RequestException as exc:
            last_reason = f"telechargement de {page.url} echoue: {exc}"
            excluded.add(page.title)
            time.sleep(settings.retry_backoff_s)
            continue

        paragraphs = extract_paragraphs(html, settings.min_paragraph_chars)
        if len(paragraphs) < settings.min_paragraphs_per_article:
            last_reason = (
                f"article {page.title!r} trop court ({len(paragraphs)} paragraphes exploitables)"
            )
            log.info("%s — nouvel essai", last_reason)
            excluded.add(page.title)
            time.sleep(settings.retry_backoff_s)
            continue

        log.info("Article retenu: %r (%d paragraphes)", page.title, len(paragraphs))
        return SourceArticle(title=page.title, url=page.url, paragraphs=paragraphs)

    raise ArticleNotFoundError(
        f"Aucun article exploitable pour {category!r} apres "
        f"{settings.max_topic_attempts} tentatives ({last_reason})."
    )

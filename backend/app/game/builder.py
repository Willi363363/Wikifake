"""Assemblage d'une partie complete : article + fausses infos -> GameData.

Remplace l'ancienne classe `FakeNewsGame`, qui etait un **singleton mutable
partage par toutes les parties** (`self.current_game`). Ici tout est fonction
pure vis-a-vis de l'etat applicatif : `build_game` renvoie un `GameData`
immuable que l'appelant stocke ou il veut (une salle, une session solo...).
"""

from __future__ import annotations

import random

from ..logging_config import get_logger
from .falsifier import inject_fakes
from .models import GameData, Paragraph, SourceArticle
from .wikipedia_source import ArticleNotFoundError, fetch_article

log = get_logger(__name__)


class GameBuildError(RuntimeError):
    """La partie n'a pas pu etre generee."""


def assemble(article: SourceArticle, rng: random.Random | None = None) -> GameData:
    """Falsifie l'article et construit le `GameData` correspondant.

    Garantie centrale : `paragraphs[i].text` contient le texte falsifie
    exactement quand `i + 1` figure dans `fake_indices`. Il n'existe plus
    aucune divergence possible entre ce que le joueur lit et ce qui est
    corrige.
    """
    fakes = inject_fakes(article.paragraphs, article.title, rng=rng)
    if not fakes:
        raise GameBuildError(
            f"Impossible d'injecter des fausses informations dans {article.title!r}."
        )

    fake_by_index = {fake.paragraph_index: fake for fake in fakes}
    paragraphs = [
        Paragraph(
            index=index,
            text=fake_by_index[index].text if index in fake_by_index else text,
            is_fake=index in fake_by_index,
        )
        for index, text in enumerate(article.paragraphs, start=1)
    ]

    return GameData(
        topic=article.title,
        wikipedia_url=article.url,
        paragraphs=paragraphs,
        fakes=fakes,
    )


def build_game(category: str, rng: random.Random | None = None) -> GameData:
    """Genere une partie pour une categorie. **Bloquant** (reseau + LLM) :
    a appeler via `asyncio.to_thread` depuis du code async."""
    try:
        article = fetch_article(category)
    except ArticleNotFoundError as exc:
        raise GameBuildError(str(exc)) from exc
    return assemble(article, rng=rng)


def build_game_from_candidates(
    candidates: list[str], rng: random.Random | None = None
) -> tuple[str, GameData]:
    """Essaie plusieurs categories dans l'ordre et retourne la premiere qui
    aboutit, avec la categorie retenue. **Bloquant.**"""
    last_error: Exception | None = None
    for candidate in candidates:
        if not candidate or not candidate.strip():
            continue
        try:
            return candidate, build_game(candidate, rng=rng)
        except Exception as exc:  # on journalise et on passe au candidat suivant
            log.warning("Echec de generation pour %r: %s", candidate, exc)
            last_error = exc
    raise GameBuildError(
        f"Aucun theme exploitable parmi {candidates!r}" + (f" ({last_error})" if last_error else "")
    )

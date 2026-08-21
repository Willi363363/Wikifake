"""Fixtures partagees.

Aucun test ne contacte OpenAI ni Wikipedia : la generation est toujours
remplacee par une fabrique locale (`sample_game`).
"""

from __future__ import annotations

import os
import random

import pytest

os.environ.setdefault("OPENAI_API_KEY", "sk-test-key-not-used")
os.environ.setdefault("WIKIFAKE_RATELIMIT", "0")
os.environ.setdefault("WIKIFAKE_LOG_LEVEL", "WARNING")

from app.config import get_settings, reset_settings_cache  # noqa: E402
from app.game.models import Fake, GameData, Paragraph, SourceArticle  # noqa: E402
from app.game.sessions import get_solo_store  # noqa: E402
from app.rooms.store import get_room_store  # noqa: E402
from app.ws.connection import get_hub  # noqa: E402


@pytest.fixture(autouse=True)
def clean_state():
    """Chaque test part d'un serveur vide."""
    reset_settings_cache()
    get_settings()
    store = get_room_store()
    store.clear()
    get_solo_store().clear()
    hub = get_hub()
    for code in list(hub._sockets):  # noqa: SLF001 - nettoyage de test
        hub.drop_room(code)
    yield
    store.clear()
    get_solo_store().clear()


@pytest.fixture
def rng() -> random.Random:
    return random.Random(1234)


def make_article(n_paragraphs: int = 6) -> SourceArticle:
    return SourceArticle(
        title="Sujet de test",
        url="https://fr.wikipedia.org/wiki/Sujet_de_test",
        paragraphs=[
            f"Paragraphe {i} " + ("contenu factuel verifiable. " * 6)
            for i in range(1, n_paragraphs + 1)
        ],
    )


def make_game(fake_indices: tuple[int, ...] = (2, 4), n_paragraphs: int = 6) -> GameData:
    """Construit un GameData coherent sans appeler le LLM."""
    article = make_article(n_paragraphs)
    fakes = [
        Fake(
            paragraph_index=index,
            original_text=article.paragraphs[index - 1],
            text=f"[FAUX] {article.paragraphs[index - 1]}",
            explanation=f"En realite, le fait du paragraphe {index} est different.",
            hint=f"Verifiez le paragraphe {index}.",
        )
        for index in fake_indices
    ]
    by_index = {f.paragraph_index: f for f in fakes}
    paragraphs = [
        Paragraph(
            index=i,
            text=by_index[i].text if i in by_index else text,
            is_fake=i in by_index,
        )
        for i, text in enumerate(article.paragraphs, start=1)
    ]
    return GameData(
        topic=article.title,
        wikipedia_url=article.url,
        paragraphs=paragraphs,
        fakes=fakes,
    )


@pytest.fixture
def sample_game() -> GameData:
    return make_game()

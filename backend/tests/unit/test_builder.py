"""Non-regression du bug central : alignement paragraphes / solution.

Historiquement `agent.py` tirait au hasard les paragraphes annonces comme
faux (`random.sample`), independamment de ceux reellement modifies. Le joueur
etait donc note sur les mauvais paragraphes.
"""

from unittest.mock import patch

import pytest

from app.game.builder import GameBuildError, assemble
from app.game.models import Fake
from tests.conftest import make_article


def _fake_falsifier(original: str, topic: str) -> dict:
    return {
        "swapped_text": f"[MODIFIE] {original}",
        "explanation": "La verite est ailleurs.",
        "hint": "Verifiez ce point.",
    }


@patch("app.game.falsifier.falsify_paragraph", side_effect=_fake_falsifier)
def test_fake_indices_match_modified_paragraphs(_mock, rng):
    article = make_article(8)
    game = assemble(article, rng=rng)

    assert game.total_fakes > 0
    for paragraph in game.paragraphs:
        expected_fake = paragraph.index in game.fake_indices
        assert paragraph.is_fake is expected_fake
        # Le texte modifie est EXACTEMENT sur le paragraphe annonce comme faux.
        assert paragraph.text.startswith("[MODIFIE]") is expected_fake


@patch("app.game.falsifier.falsify_paragraph", side_effect=_fake_falsifier)
def test_untouched_paragraphs_keep_source_text(_mock, rng):
    article = make_article(8)
    game = assemble(article, rng=rng)
    for paragraph in game.paragraphs:
        if not paragraph.is_fake:
            assert paragraph.text == article.paragraphs[paragraph.index - 1]


@patch("app.game.falsifier.falsify_paragraph", side_effect=_fake_falsifier)
def test_indices_are_one_based_and_contiguous(_mock, rng):
    game = assemble(make_article(5), rng=rng)
    assert [p.index for p in game.paragraphs] == [1, 2, 3, 4, 5]
    assert all(1 <= i <= 5 for i in game.fake_indices)


@patch("app.game.falsifier.falsify_paragraph", return_value=None)
def test_build_fails_loudly_when_llm_returns_nothing(_mock, rng):
    with pytest.raises(GameBuildError):
        assemble(make_article(5), rng=rng)


@patch("app.game.falsifier.falsify_paragraph", side_effect=_fake_falsifier)
def test_public_payload_hides_the_solution(_mock, rng):
    """Le client ne doit pas pouvoir deduire les reponses des paragraphes."""
    game = assemble(make_article(6), rng=rng)
    payload = game.to_public_dict()
    for paragraph in payload["paragraphs"]:
        assert set(paragraph) == {"index", "text"}
        assert "is_fake" not in paragraph


def test_fake_public_dict_shape():
    fake = Fake(3, "avant", "apres", "explication", "indice")
    assert fake.to_public_dict() == {
        "paragraph_index": 3,
        "text": "apres",
        "explanation": "explication",
        "hint": "indice",
    }

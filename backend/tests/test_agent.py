import pytest
from unittest.mock import patch, MagicMock
from src.core.agent import FakeNewsGame

@pytest.fixture
def fake_game():
    return FakeNewsGame()

def test_game_init(fake_game):
    assert fake_game.current_game is None
    assert fake_game.current_topic is None
    assert fake_game.get_current_game() is None

@patch('src.core.agent.get_wikipedia_content')
def test_start_game_no_wiki_data(mock_get_wiki, fake_game):
    mock_get_wiki.return_value = None
    result = fake_game.start_game("Cat")
    assert result is None

@patch('src.core.agent.swap_paragraphs')
@patch('src.core.agent.extract_paragraphs')
@patch('src.core.agent.get_wikipedia_content')
def test_start_game_success(mock_get_wiki, mock_extract, mock_swap, fake_game):
    # Setup mock returns
    mock_get_wiki.return_value = {
        "title": "Cat",
        "url": "https://fr.wikipedia.org/wiki/Cat",
        "soup": MagicMock(),
        "raw_paragraphs": [MagicMock(), MagicMock(), MagicMock()]
    }
    mock_extract.return_value = ["Para 1", "Para 2", "Para 3"]
    mock_swap.return_value = (
        ["Para 1 Fake", "Para 2", "Para 3"],
        [{"paragraph_index": 0, "original_text": "Para 1", "swapped_text": "Para 1 Fake",
          "explanation": "fake", "hint": "fake"}]
    )

    result = fake_game.start_game("Cat")
    
    assert result is not None
    assert fake_game.current_topic == "Cat"
    assert result["topic"] == "Cat"
    assert result["total_false_statements"] == 1
    assert len(result["positions"]) == 1
    assert result["wikipedia_url"] == "https://fr.wikipedia.org/wiki/Cat"

def test_submit_answers_no_game(fake_game):
    result = fake_game.submit_answers([1, 2])
    assert "error" in result

@patch('src.core.agent.get_wikipedia_content')
@patch('src.core.agent.extract_paragraphs')
@patch('src.core.agent.swap_paragraphs')
def test_submit_answers_with_game(mock_swap, mock_extract, mock_wiki, fake_game):
    mock_wiki.return_value = {
        "title": "Dog",
        "url": "",
        "soup": MagicMock(),
        "raw_paragraphs": [MagicMock(), MagicMock()]
    }
    mock_extract.return_value = ["P1", "P2"]
    mock_swap.return_value = (
        ["P1 fake", "P2"],
        [{"paragraph_index": 0, "original_text": "P1", "swapped_text": "P1 fake",
          "explanation": "a", "hint": "b"}]
    )
    fake_game.start_game("Dog")

    # The paragraph chosen is somewhat random due to random.sample, 
    # but we can test the submit_answers method doesn't crash and returns the correct structure.
    res = fake_game.submit_answers([0]) # 0-indexed in some logic or 1-indexed? The game uses 1-indexed.
    assert "check_result" in res
    assert "feedback" in res
    assert "correct_misinformations" in res
    
def test_reset_game(fake_game):
    fake_game.current_game = {"test": 123}
    fake_game.current_topic = "test"
    fake_game.reset_game()
    assert fake_game.current_game is None
    assert fake_game.current_topic is None


# --- Non-régression : alignement paragraphes / vérité terrain ----------------
#
# `agent.py` tirait auparavant les paragraphes déclarés faux au hasard
# (`random.sample`), indépendamment de ceux réellement modifiés par le LLM.
# Le joueur était donc noté sur les mauvais paragraphes.

def _wiki_data(n_paragraphs: int) -> dict:
    return {
        "title": "Sujet",
        "url": "https://fr.wikipedia.org/wiki/Sujet",
        "soup": MagicMock(),
        "raw_paragraphs": [MagicMock() for _ in range(n_paragraphs)],
    }


@patch('src.core.agent.swap_paragraphs')
@patch('src.core.agent.extract_paragraphs')
@patch('src.core.agent.get_wikipedia_content')
def test_positions_point_to_the_modified_paragraphs(mock_wiki, mock_extract, mock_swap, fake_game):
    originals = [f"Paragraphe {i}" for i in range(1, 7)]
    mock_wiki.return_value = _wiki_data(6)
    mock_extract.return_value = originals

    # Le LLM a modifié les paragraphes d'index 1 et 4 (base 0).
    modified = list(originals)
    modified[1] = "FAUX 2"
    modified[4] = "FAUX 5"
    mock_swap.return_value = (modified, [
        {"paragraph_index": 4, "original_text": originals[4], "swapped_text": "FAUX 5",
         "explanation": "e5", "hint": "h5"},
        {"paragraph_index": 1, "original_text": originals[1], "swapped_text": "FAUX 2",
         "explanation": "e2", "hint": "h2"},
    ])

    result = fake_game.start_game("Sujet")

    # positions est en base 1 et désigne exactement les paragraphes altérés
    assert sorted(p["paragraph_index"] for p in result["positions"]) == [2, 5]

    # et le texte annoncé correspond au texte réellement présent dans l'article
    for position in result["positions"]:
        rendered = result["paragraphs"][position["paragraph_index"] - 1]
        assert rendered == position["false_statement"]


@patch('src.core.agent.swap_paragraphs')
@patch('src.core.agent.extract_paragraphs')
@patch('src.core.agent.get_wikipedia_content')
def test_untouched_paragraphs_are_never_flagged(mock_wiki, mock_extract, mock_swap, fake_game):
    originals = [f"Paragraphe {i}" for i in range(1, 6)]
    mock_wiki.return_value = _wiki_data(5)
    mock_extract.return_value = originals

    modified = list(originals)
    modified[2] = "FAUX 3"
    mock_swap.return_value = (modified, [
        {"paragraph_index": 2, "original_text": originals[2], "swapped_text": "FAUX 3",
         "explanation": "e", "hint": "h"},
    ])

    result = fake_game.start_game("Sujet")
    flagged = {p["paragraph_index"] for p in result["positions"]}

    assert flagged == {3}
    for index, text in enumerate(result["paragraphs"], start=1):
        if index not in flagged:
            assert text == originals[index - 1]


@patch('src.core.agent.swap_paragraphs')
@patch('src.core.agent.extract_paragraphs')
@patch('src.core.agent.get_wikipedia_content')
def test_false_info_numbers_are_sequential(mock_wiki, mock_extract, mock_swap, fake_game):
    originals = [f"P{i}" for i in range(6)]
    mock_wiki.return_value = _wiki_data(6)
    mock_extract.return_value = originals
    mock_swap.return_value = (originals, [
        {"paragraph_index": i, "original_text": f"P{i}", "swapped_text": f"F{i}",
         "explanation": "e", "hint": "h"}
        for i in (5, 0, 3)
    ])

    result = fake_game.start_game("Sujet")
    positions = result["positions"]

    assert [p["false_info_number"] for p in positions] == [1, 2, 3]
    assert [p["paragraph_index"] for p in positions] == [1, 4, 6]

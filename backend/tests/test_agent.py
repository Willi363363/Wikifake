import pytest
from unittest.mock import patch, MagicMock
from src.backend.core.agent import FakeNewsGame

@pytest.fixture
def fake_game():
    return FakeNewsGame()

def test_game_init(fake_game):
    assert fake_game.current_game is None
    assert fake_game.current_topic is None
    assert fake_game.get_current_game() is None

@patch('src.backend.core.agent.get_wikipedia_content')
def test_start_game_no_wiki_data(mock_get_wiki, fake_game):
    mock_get_wiki.return_value = None
    result = fake_game.start_game("Cat")
    assert result is None

@patch('src.backend.core.agent.swap_paragraphs')
@patch('src.backend.core.agent.extract_paragraphs')
@patch('src.backend.core.agent.get_wikipedia_content')
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
        [{"original_text": "Para 1", "swapped_text": "Para 1 Fake", "explanation": "fake", "hint": "fake"}]
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

@patch('src.backend.core.agent.get_wikipedia_content')
@patch('src.backend.core.agent.extract_paragraphs')
@patch('src.backend.core.agent.swap_paragraphs')
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
        [{"original_text": "P1", "swapped_text": "P1 fake", "explanation": "a", "hint": "b"}]
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

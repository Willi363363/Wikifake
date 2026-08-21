"""Generation d'une partie : Wikipedia -> paragraphes -> fausses infos."""

from .answers import AnswerCheck, check_answers
from .builder import build_game, build_game_from_candidates
from .models import Fake, GameData, Paragraph

__all__ = [
    "AnswerCheck",
    "check_answers",
    "build_game",
    "build_game_from_candidates",
    "Fake",
    "GameData",
    "Paragraph",
]

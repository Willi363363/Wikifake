"""Core game logic: scraping, misinformation injection, verification, and scoring."""
from .agent import FakeNewsGame
from .verification import check_answer, get_feedback

__all__ = ["FakeNewsGame", "check_answer", "get_feedback"]
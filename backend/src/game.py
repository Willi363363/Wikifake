"""Process-wide FakeNewsGame singleton.

Both the REST endpoints (solo mode) and the realtime handlers (multiplayer)
drive the same generator instance, exactly as the old monolith did — kept in
its own module so `api` and `realtime` can share it without importing each other.
`load_dotenv()` runs before instantiation so API keys are available.
"""
from dotenv import load_dotenv

from src.core.agent import FakeNewsGame

load_dotenv()
game = FakeNewsGame()

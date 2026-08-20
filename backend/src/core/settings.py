import os
from pathlib import Path
from dotenv import load_dotenv

_backend_dir = Path(__file__).resolve().parent.parent.parent
_root_dir = _backend_dir.parent

load_dotenv(_backend_dir / ".env")
load_dotenv(_root_dir / ".env")
load_dotenv()

if "GEMINI_API_KEY" in os.environ and "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

MODEL_NAME = os.getenv("MODEL_NAME", "gemini-3.1-flash-lite")
GAME_MODE = "misinformation_hunt"  # Type de jeu



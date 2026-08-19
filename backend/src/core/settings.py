import os
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = os.getenv("MODEL_NAME", "gemini-2.0-flash")
GAME_MODE = "misinformation_hunt"  # Type de jeu

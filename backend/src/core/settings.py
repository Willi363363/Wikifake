import os
from pathlib import Path
from dotenv import load_dotenv

_backend_dir = Path(__file__).resolve().parent.parent.parent
_root_dir = _backend_dir.parent

_backend_env = _backend_dir / ".env"
_root_env = _root_dir / ".env"

# Précédence volontaire et explicite : environnement exporté > backend/.env >
# .env racine. On charge du moins spécifique au plus spécifique avec
# override=True pour que l'ordre entre les deux fichiers soit décidé ici plutôt
# que par le « premier arrivé » de load_dotenv(), puis on restaure les variables
# déjà exportées : la config de la plateforme (Render, Docker, CI) doit toujours
# gagner sur un fichier local.
_exported = dict(os.environ)

load_dotenv(_root_env, override=True)
load_dotenv(_backend_env, override=True)
load_dotenv()

os.environ.update(_exported)

if _backend_env.exists() and _root_env.exists():
    print(
        f"⚠️  Deux fichiers .env détectés ({_root_env} et {_backend_env}) : "
        f"les valeurs de {_backend_env} l'emportent."
    )

if "GEMINI_API_KEY" in os.environ and "GOOGLE_API_KEY" not in os.environ:
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

MODEL_NAME = os.getenv("MODEL_NAME", "gemini-3.1-flash-lite")
GAME_MODE = "misinformation_hunt"  # Type de jeu

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


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "")
    try:
        return int(raw)
    except ValueError:
        return default


# ---------------------------------------------------------------------------
# Génération d'article
#
# Les deux seuils de longueur ci-dessous répondent à deux questions
# différentes, mais l'un contraint l'autre : un paragraphe non retenu par le
# scraper ne peut jamais être falsifié. Ils sont donc déclarés côte à côte.
# ---------------------------------------------------------------------------

# Longueur minimale pour qu'un <p> compte comme paragraphe de contenu
# (élimine légendes, notes et bandeaux).
MIN_CONTENT_CHARS = _env_int("MIN_CONTENT_CHARS", 50)

# Longueur minimale pour qu'un paragraphe soit falsifiable : sous ce seuil il
# n'y a pas assez de faits pour en altérer un discrètement.
MIN_FALSIFIABLE_CHARS = _env_int("MIN_FALSIFIABLE_CHARS", 100)

# Nombre de paragraphes de contenu exigés pour qu'un article soit jouable.
MIN_ARTICLE_PARAGRAPHS = _env_int("MIN_ARTICLE_PARAGRAPHS", 3)

# Borne les tentatives de recherche d'article : chaque essai coûte un appel au
# modèle, la boucle ne doit donc jamais être infinie.
MAX_TOPIC_ATTEMPTS = _env_int("MAX_TOPIC_ATTEMPTS", 6)

# Délai maximal d'une requête HTTP vers Wikipédia, en secondes.
HTTP_TIMEOUT = _env_int("HTTP_TIMEOUT", 15)

# ---------------------------------------------------------------------------
# Cache d'articles
#
# Chaque partie générée coûte des appels au modèle. Un article falsifié est
# réutilisable, et le réutiliser rend aussi le chargement instantané.
# ---------------------------------------------------------------------------

# Durée de vie d'un article en cache, en secondes (6 h par défaut).
ARTICLE_CACHE_TTL = _env_int("ARTICLE_CACHE_TTL", 6 * 3600)

# Nombre de catégories mémorisées ; au-delà, la moins récemment servie est
# évincée. Borne la mémoire d'un process.
ARTICLE_CACHE_MAX_CATEGORIES = _env_int("ARTICLE_CACHE_MAX_CATEGORIES", 200)

# Articles distincts conservés par catégorie : une même recherche ne doit pas
# servir éternellement le même article.
ARTICLE_CACHE_VARIANTS = _env_int("ARTICLE_CACHE_VARIANTS", 3)

# Mettre à 0 pour désactiver le cache (mesure du coût brut, débogage).
ARTICLE_CACHE_ENABLED = _env_int("ARTICLE_CACHE_ENABLED", 1)

# ---------------------------------------------------------------------------
# Limites de salle
# ---------------------------------------------------------------------------

MAX_PLAYER_NAME_LENGTH = _env_int("MAX_PLAYER_NAME_LENGTH", 24)
MAX_CHAT_LENGTH = _env_int("MAX_CHAT_LENGTH", 400)

# Intervalle minimal entre deux positions de curseur relayées, en secondes :
# un client modifié ne doit pas pouvoir saturer la salle.
CURSOR_MIN_INTERVAL = float(os.getenv("CURSOR_MIN_INTERVAL", "0.04"))

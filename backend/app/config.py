"""Configuration centrale.

SOURCE UNIQUE de toutes les constantes reglables du backend. Tout est
surchargeable par variable d'environnement, ce qui evite d'avoir a toucher
au code pour changer un timing ou un modele.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# backend/app/config.py -> backend/app -> backend -> racine du depot
BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class GameSettings:
    """Parametres de generation de partie."""

    model_name: str = field(default_factory=lambda: os.getenv("WIKIFAKE_MODEL", "gpt-4o-mini"))
    language: str = field(default_factory=lambda: os.getenv("WIKIFAKE_WIKI_LANG", "fr"))
    user_agent: str = field(
        default_factory=lambda: os.getenv(
            "WIKIFAKE_USER_AGENT", "WikiFake/2.0 (educational fact-checking game)"
        )
    )
    # Nombre de fausses informations injectees par article.
    fakes_per_article: int = field(default_factory=lambda: _env_int("WIKIFAKE_FAKES", 4))
    # SOURCE UNIQUE du seuil de longueur d'un paragraphe exploitable.
    min_paragraph_chars: int = field(
        default_factory=lambda: _env_int("WIKIFAKE_MIN_PARAGRAPH_CHARS", 100)
    )
    min_paragraphs_per_article: int = field(
        default_factory=lambda: _env_int("WIKIFAKE_MIN_PARAGRAPHS", 3)
    )
    # Bornes des boucles de recherche : plus jamais de `while True`.
    max_topic_attempts: int = field(default_factory=lambda: _env_int("WIKIFAKE_MAX_ATTEMPTS", 6))
    http_timeout_s: float = field(default_factory=lambda: _env_float("WIKIFAKE_HTTP_TIMEOUT", 15.0))
    retry_backoff_s: float = field(
        default_factory=lambda: _env_float("WIKIFAKE_RETRY_BACKOFF", 1.0)
    )


@dataclass(frozen=True)
class RoomSettings:
    """Parametres du multijoueur."""

    # SOURCE UNIQUE de la duree par defaut d'une partie (le frontend la recoit
    # du serveur, il ne la redefinit jamais).
    default_duration_s: int = field(default_factory=lambda: _env_int("WIKIFAKE_DURATION", 180))
    min_duration_s: int = field(default_factory=lambda: _env_int("WIKIFAKE_MIN_DURATION", 30))
    max_duration_s: int = field(default_factory=lambda: _env_int("WIKIFAKE_MAX_DURATION", 600))
    code_length: int = 6
    max_players: int = field(default_factory=lambda: _env_int("WIKIFAKE_MAX_PLAYERS", 8))
    max_name_length: int = field(default_factory=lambda: _env_int("WIKIFAKE_MAX_NAME_LEN", 20))
    max_chat_length: int = field(default_factory=lambda: _env_int("WIKIFAKE_MAX_CHAT_LEN", 400))
    max_rooms: int = field(default_factory=lambda: _env_int("WIKIFAKE_MAX_ROOMS", 200))
    # Distribution d'items
    item_interval_s: int = field(default_factory=lambda: _env_int("WIKIFAKE_ITEM_INTERVAL", 30))
    max_item_waves: int = field(default_factory=lambda: _env_int("WIKIFAKE_ITEM_WAVES", 9))
    # Nettoyage : une salle vide (aucun joueur connecte) expire apres ce delai.
    empty_room_ttl_s: int = field(default_factory=lambda: _env_int("WIKIFAKE_ROOM_TTL", 900))
    reaper_interval_s: int = field(default_factory=lambda: _env_int("WIKIFAKE_REAPER_INTERVAL", 60))
    cursor_min_interval_s: float = field(
        default_factory=lambda: _env_float("WIKIFAKE_CURSOR_INTERVAL", 0.04)
    )


@dataclass(frozen=True)
class ScoreSettings:
    """SOURCE UNIQUE de la formule de score (cf. app/rooms/scoring.py)."""

    points_per_hit: int = field(default_factory=lambda: _env_int("WIKIFAKE_PTS_HIT", 150))
    penalty_per_miss: int = field(default_factory=lambda: _env_int("WIKIFAKE_PTS_FALSE_POS", 80))
    time_bonus_per_second: float = field(
        default_factory=lambda: _env_float("WIKIFAKE_PTS_TIME", 0.5)
    )
    # Cout d'un indice textuel, et multiplicateur pour la localisation.
    hint_penalty: int = field(default_factory=lambda: _env_int("WIKIFAKE_PTS_HINT", 50))
    reveal_cost_factor: int = field(
        default_factory=lambda: _env_int("WIKIFAKE_PTS_REVEAL_FACTOR", 4)
    )
    steal_amount: int = field(default_factory=lambda: _env_int("WIKIFAKE_PTS_STEAL", 50))
    time_malus_s: int = field(default_factory=lambda: _env_int("WIKIFAKE_TIME_MALUS", 10))


@dataclass(frozen=True)
class RateLimitSettings:
    """Garde-fou sur les routes qui declenchent des appels LLM payants."""

    enabled: bool = field(default_factory=lambda: _env_bool("WIKIFAKE_RATELIMIT", True))
    max_calls: int = field(default_factory=lambda: _env_int("WIKIFAKE_RATELIMIT_CALLS", 10))
    window_s: float = field(default_factory=lambda: _env_float("WIKIFAKE_RATELIMIT_WINDOW", 60.0))


@dataclass(frozen=True)
class Paths:
    """Chemins du projet.

    Tous les champs passent par `default_factory` : les valeurs sont lues au
    moment de l'instanciation, pas a l'import du module. C'est ce qui permet
    a un test (ou a un deploiement) de surcharger `WIKIFAKE_DATA_DIR` puis
    d'appeler `reset_settings_cache()`.
    """

    repo_root: Path = field(default_factory=lambda: REPO_ROOT)
    backend_dir: Path = field(default_factory=lambda: BACKEND_DIR)
    shared_dir: Path = field(default_factory=lambda: REPO_ROOT / "shared")
    data_dir: Path = field(
        default_factory=lambda: Path(os.getenv("WIKIFAKE_DATA_DIR", str(BACKEND_DIR / "data")))
    )
    frontend_dist: Path = field(
        default_factory=lambda: Path(
            os.getenv("WIKIFAKE_FRONTEND_DIST", str(REPO_ROOT / "frontend" / "dist"))
        )
    )


@dataclass(frozen=True)
class Settings:
    game: GameSettings = field(default_factory=GameSettings)
    rooms: RoomSettings = field(default_factory=RoomSettings)
    score: ScoreSettings = field(default_factory=ScoreSettings)
    rate_limit: RateLimitSettings = field(default_factory=RateLimitSettings)
    paths: Paths = field(default_factory=Paths)
    log_level: str = field(default_factory=lambda: os.getenv("WIKIFAKE_LOG_LEVEL", "INFO"))
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))

    @property
    def llm_available(self) -> bool:
        return bool(self.openai_api_key.strip())


_settings: Settings | None = None


def get_settings() -> Settings:
    """Accesseur unique (instancie a la demande pour que les tests puissent
    modifier l'environnement avant le premier appel)."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


def reset_settings_cache() -> None:
    """Utilise par les tests apres modification de l'environnement."""
    global _settings
    _settings = None

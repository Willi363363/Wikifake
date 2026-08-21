"""Sessions du mode solo.

Le mode solo a besoin d'un état serveur pour la même raison que le
multijoueur : la solution de la partie ne doit pas être envoyée au client, et
les indices consommés doivent être comptés ailleurs que dans le navigateur.

Une session retient l'article généré, l'heure de départ et les indices payés.
Elle expire au bout d'une heure, purgée paresseusement à chaque création.
"""
import secrets
import time
from dataclasses import dataclass, field

from src.scoring import hint_penalty_for

SESSION_TTL_SECONDS = 3600

# Garde-fou mémoire : au-delà, les sessions les plus anciennes sont oubliées.
MAX_SESSIONS = 500


@dataclass
class SoloSession:
    """Une partie solo en cours."""
    id: str
    game_data: dict
    time_limit: int
    started_at: float = field(default_factory=time.time)
    hint_levels: dict[int, int] = field(default_factory=dict)
    scanned: list[int] = field(default_factory=list)
    finished: bool = False

    @property
    def elapsed(self) -> float:
        return time.time() - self.started_at

    @property
    def expired(self) -> bool:
        return self.elapsed > SESSION_TTL_SECONDS

    @property
    def positions(self) -> list[dict]:
        return self.game_data["positions"]

    @property
    def hints_used(self) -> int:
        return sum(1 for level in self.hint_levels.values() if level > 0)

    @property
    def hint_penalty(self) -> int:
        return hint_penalty_for(self.hint_levels)

    def position(self, number: int) -> dict | None:
        return next((p for p in self.positions if p["false_info_number"] == number), None)

    def unlock(self, number: int, level: int) -> int:
        """Déverrouille un indice et retourne le niveau effectivement acquis."""
        self.hint_levels[number] = max(self.hint_levels.get(number, 0), level)
        return self.hint_levels[number]


# Registre des sessions : identifiant -> session.
_sessions: dict[str, SoloSession] = {}


def purge() -> int:
    """Oublie les sessions expirées. Retourne le nombre supprimé."""
    stale = [sid for sid, session in _sessions.items() if session.expired]
    for sid in stale:
        del _sessions[sid]
    return len(stale)


def create(game_data: dict, time_limit: int) -> SoloSession:
    purge()
    if len(_sessions) >= MAX_SESSIONS:
        oldest = min(_sessions.values(), key=lambda s: s.started_at)
        del _sessions[oldest.id]
    session = SoloSession(
        id=secrets.token_urlsafe(12),
        game_data=game_data,
        time_limit=time_limit,
    )
    _sessions[session.id] = session
    return session


def get(session_id: str) -> SoloSession | None:
    session = _sessions.get(session_id)
    if session is not None and session.expired:
        del _sessions[session_id]
        return None
    return session


def clear() -> None:
    """Réinitialisation complète (suite de tests)."""
    _sessions.clear()


def count() -> int:
    return len(_sessions)

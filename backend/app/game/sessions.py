"""Sessions solo.

Le mode solo a besoin d'un etat serveur (temps de depart, indices consommes)
pour que le score reste calcule par le serveur, exactement comme en
multijoueur. Auparavant un singleton `FakeNewsGame` partage servait toutes
les parties : deux joueurs solo simultanes s'ecrasaient mutuellement.
"""

from __future__ import annotations

import secrets
import time
from dataclasses import dataclass, field

from ..config import get_settings
from ..logging_config import get_logger
from .models import GameData

log = get_logger(__name__)

SESSION_TTL_S = 3600


@dataclass
class SoloSession:
    id: str
    game: GameData
    duration_s: int
    started_at: float = field(default_factory=time.time)
    hint_levels: dict[int, int] = field(default_factory=dict)
    revealed_indices: list[int] = field(default_factory=list)
    finished: bool = False

    @property
    def hints_used(self) -> int:
        """Unites d'indice facturables (meme bareme qu'en multijoueur)."""
        from ..rooms.scoring import hint_cost_units

        return hint_cost_units(self.hint_levels)

    @property
    def seconds_remaining(self) -> float:
        return max(0.0, self.duration_s - (time.time() - self.started_at))

    @property
    def expired(self) -> bool:
        return time.time() - self.started_at > SESSION_TTL_S


class SoloSessionStore:
    """Registre en memoire avec purge paresseuse."""

    def __init__(self) -> None:
        self._sessions: dict[str, SoloSession] = {}

    def create(self, game: GameData, duration_s: int | None = None) -> SoloSession:
        self.purge()
        cfg = get_settings().rooms
        duration = duration_s if duration_s is not None else cfg.default_duration_s
        duration = max(cfg.min_duration_s, min(cfg.max_duration_s, int(duration)))
        session = SoloSession(id=secrets.token_urlsafe(12), game=game, duration_s=duration)
        self._sessions[session.id] = session
        return session

    def get(self, session_id: str) -> SoloSession | None:
        session = self._sessions.get(session_id)
        if session is not None and session.expired:
            self._sessions.pop(session_id, None)
            return None
        return session

    def purge(self) -> int:
        doomed = [sid for sid, s in self._sessions.items() if s.expired]
        for sid in doomed:
            self._sessions.pop(sid, None)
        return len(doomed)

    def clear(self) -> None:
        self._sessions.clear()

    def __len__(self) -> int:
        return len(self._sessions)


_store: SoloSessionStore | None = None


def get_solo_store() -> SoloSessionStore:
    global _store
    if _store is None:
        _store = SoloSessionStore()
    return _store

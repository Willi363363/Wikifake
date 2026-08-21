"""Stockage en memoire des salles + nettoyage automatique.

Corrige la fuite de l'ancien `rooms = {}` global : les salles vides sont
collectees par une tache periodique, les codes sont garantis uniques et le
nombre de salles est borne.
"""

from __future__ import annotations

import asyncio
import contextlib
import random
import re
import string
import time

from ..config import get_settings
from ..logging_config import get_logger
from .models import Player, Room, RoomState

log = get_logger(__name__)

# Palette assignee aux joueurs dans l'ordre d'arrivee.
PLAYER_COLORS = (
    "#e63946",
    "#2a9d8f",
    "#8338ec",
    "#f4a261",
    "#264653",
    "#ff006e",
    "#3a0ca3",
    "#fb5607",
)

_NAME_RE = re.compile(r"^[\w\-. ]+$", re.UNICODE)
_CODE_ALPHABET = string.ascii_uppercase + string.digits


class RoomError(RuntimeError):
    """Erreur fonctionnelle destinee a etre renvoyee au client."""


class RoomFullError(RoomError):
    pass


class NameTakenError(RoomError):
    pass


class InvalidNameError(RoomError):
    pass


def validate_player_name(raw: str) -> str:
    """Nettoie et valide un pseudo (longueur, caracteres)."""
    name = (raw or "").strip()
    max_len = get_settings().rooms.max_name_length
    if not name:
        raise InvalidNameError("Le pseudo ne peut pas etre vide.")
    if len(name) > max_len:
        raise InvalidNameError(f"Le pseudo ne peut pas depasser {max_len} caracteres.")
    if not _NAME_RE.match(name):
        raise InvalidNameError("Le pseudo contient des caracteres non autorises.")
    return name


class RoomStore:
    """Registre des salles. Une seule instance par process (cf. `get_room_store`)."""

    def __init__(self, rng: random.Random | None = None) -> None:
        self._rooms: dict[str, Room] = {}
        self._rng = rng or random.Random()
        self._reaper: asyncio.Task | None = None

    # --- acces ------------------------------------------------------------
    def __contains__(self, code: str) -> bool:
        return code in self._rooms

    def __len__(self) -> int:
        return len(self._rooms)

    @property
    def codes(self) -> list[str]:
        return list(self._rooms)

    def get(self, code: str) -> Room | None:
        return self._rooms.get(code)

    def require(self, code: str) -> Room:
        room = self._rooms.get(code)
        if room is None:
            raise RoomError(f"Salle {code} introuvable.")
        return room

    # --- cycle de vie -----------------------------------------------------
    def _generate_code(self) -> str:
        length = get_settings().rooms.code_length
        for _ in range(50):
            code = "".join(self._rng.choices(_CODE_ALPHABET, k=length))
            if code not in self._rooms:
                return code
        raise RoomError("Impossible de generer un code de salle unique.")

    def create(self) -> Room:
        settings = get_settings().rooms
        if len(self._rooms) >= settings.max_rooms:
            self.collect_expired(force_empty=True)
        if len(self._rooms) >= settings.max_rooms:
            raise RoomError("Trop de salles ouvertes, reessayez dans un instant.")
        room = Room(code=self._generate_code(), duration_s=settings.default_duration_s)
        room.empty_since = time.time()
        self._rooms[room.code] = room
        log.info("Salle %s creee (%d salles actives)", room.code, len(self._rooms))
        return room

    def delete(self, code: str) -> None:
        if self._rooms.pop(code, None) is not None:
            log.info("Salle %s supprimee (%d restantes)", code, len(self._rooms))

    def clear(self) -> None:
        """Reinitialisation complete (utilise par les tests)."""
        self._rooms.clear()

    # --- joueurs ----------------------------------------------------------
    def _next_color(self, room: Room) -> str:
        used = {p.color for p in room.players.values()}
        free = [c for c in PLAYER_COLORS if c not in used]
        return free[0] if free else self._rng.choice(PLAYER_COLORS)

    def join(self, room: Room, raw_name: str) -> Player:
        """Ajoute un joueur, ou le reconnecte s'il revient.

        Un joueur deconnecte garde son score et ses items : reconnecter ne
        remet plus la partie a zero (ancien comportement : suppression seche).
        """
        name = validate_player_name(raw_name)
        settings = get_settings().rooms

        existing = room.players.get(name)
        if existing is not None:
            if existing.connected:
                raise NameTakenError(f"Le pseudo {name!r} est deja utilise dans cette salle.")
            existing.connected = True
            room.empty_since = None
            room.promote_new_host()
            log.info("%s se reconnecte a %s", name, room.code)
            return existing

        if len(room.connected_players) >= settings.max_players:
            raise RoomFullError(f"La salle est pleine ({settings.max_players} joueurs).")
        if room.state is RoomState.PLAYING:
            raise RoomError("La partie a deja commence, impossible de rejoindre.")

        player = Player(name=name, color=self._next_color(room))
        room.players[name] = player
        room.empty_since = None
        room.promote_new_host()
        log.info("%s rejoint %s (%d joueurs)", name, room.code, len(room.players))
        return player

    def leave(self, room: Room, name: str) -> None:
        """Marque un joueur deconnecte sans detruire son etat."""
        player = room.players.get(name)
        if player is None:
            return
        player.connected = False
        player.ready = False
        if room.state is not RoomState.PLAYING:
            # Hors partie, inutile de garder un fantome dans la liste.
            room.players.pop(name, None)
        room.promote_new_host()
        if room.is_empty:
            room.empty_since = time.time()
        log.info("%s quitte %s", name, room.code)

    # --- nettoyage --------------------------------------------------------
    def collect_expired(self, force_empty: bool = False) -> int:
        """Supprime les salles vides expirees. Retourne le nombre supprime."""
        ttl = get_settings().rooms.empty_room_ttl_s
        now = time.time()
        doomed = [
            code
            for code, room in self._rooms.items()
            if room.is_empty
            and room.empty_since is not None
            and (force_empty or now - room.empty_since > ttl)
        ]
        for code in doomed:
            self.delete(code)
        return len(doomed)

    async def _reap_loop(self) -> None:
        interval = get_settings().rooms.reaper_interval_s
        try:
            while True:
                await asyncio.sleep(interval)
                removed = self.collect_expired()
                if removed:
                    log.info("Nettoyage: %d salle(s) expiree(s)", removed)
        except asyncio.CancelledError:
            pass

    def start_reaper(self) -> None:
        if self._reaper is None or self._reaper.done():
            self._reaper = asyncio.create_task(self._reap_loop())

    async def stop_reaper(self) -> None:
        if self._reaper is not None and not self._reaper.done():
            self._reaper.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._reaper
        self._reaper = None


_store: RoomStore | None = None


def get_room_store() -> RoomStore:
    global _store
    if _store is None:
        _store = RoomStore()
    return _store

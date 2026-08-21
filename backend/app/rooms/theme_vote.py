"""Phase de vote de theme et lancement de la generation."""

from __future__ import annotations

import asyncio
import random

from ..game.builder import GameBuildError, build_game_from_candidates
from ..logging_config import get_logger
from ..ws.protocol import ServerMessage
from .broadcasting import RoomBroadcaster
from .models import Room, RoomState

log = get_logger(__name__)

# Themes de secours si aucune proposition n'aboutit.
FALLBACK_THEMES = (
    "Paris",
    "Chat",
    "Chocolat",
    "Football",
    "Soleil",
    "Lune",
    "Château de Versailles",
    "Pizza",
    "Japon",
    "Cinéma",
)


class ThemeVote:
    """Collecte les propositions, puis genere la partie hors event loop."""

    def __init__(self, broadcaster: RoomBroadcaster, rng: random.Random) -> None:
        self.broadcaster = broadcaster
        self.rng = rng

    async def open(self, room: Room) -> None:
        if room.state in (RoomState.THEME_VOTING, RoomState.GENERATING, RoomState.PLAYING):
            return
        room.state = RoomState.THEME_VOTING
        room.theme_votes = {}
        await self.broadcaster.to_room(room, ServerMessage.THEME_VOTE_START)
        await self.broadcaster.lobby(room)

    async def register(self, room: Room, player_name: str, theme: str) -> bool:
        """Enregistre un vote. Retourne True si tout le monde a vote."""
        theme = theme.strip()[:80]
        if not theme:
            return False
        room.theme_votes[player_name] = theme

        connected = [player.name for player in room.connected_players]
        await self.broadcaster.to_room(
            room,
            ServerMessage.THEME_VOTE_UPDATE,
            submitted=[name for name in connected if name in room.theme_votes],
            total=len(connected),
        )
        return bool(connected) and all(name in room.theme_votes for name in connected)

    def candidates(self, room: Room) -> list[str]:
        proposals = list(dict.fromkeys(room.theme_votes.values()))
        self.rng.shuffle(proposals)
        return proposals + list(FALLBACK_THEMES)

    async def generate(self, room: Room) -> tuple[str, object] | None:
        """Annonce le theme retenu puis genere la partie dans un thread.

        `build_game_from_candidates` est bloquant (HTTP + LLM) : l'executer
        directement dans la coroutine gelerait TOUTES les salles.
        """
        if room.state is RoomState.GENERATING:
            return None

        candidates = self.candidates(room)
        room.state = RoomState.GENERATING
        proposer = next(
            (name for name, theme in room.theme_votes.items() if theme == candidates[0]),
            "Système",
        )
        await self.broadcaster.to_room(
            room, ServerMessage.THEME_SELECTED, theme=candidates[0], proposer=proposer
        )

        try:
            chosen, game = await asyncio.to_thread(build_game_from_candidates, candidates, self.rng)
        except GameBuildError as exc:
            log.warning("Generation impossible pour %s: %s", room.code, exc)
            room.state = RoomState.WAITING
            await self.broadcaster.room_error(
                room,
                "Impossible de generer une partie. Reessayez avec un autre theme.",
                "generation_failed",
            )
            await self.broadcaster.lobby(room)
            return None

        return chosen, game

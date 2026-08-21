"""Orchestration d'une salle : demarrage, reponses, indices, fin de partie.

Facade mince : la diffusion vit dans `broadcasting.py`, les items dans
`item_engine.py`, le vote de theme dans `theme_vote.py`. C'est le SEUL
endroit ou une partie est demarree ou terminee (l'ancien code avait deux
chemins divergents).
"""

from __future__ import annotations

import asyncio
import contextlib
import random
import time
from dataclasses import dataclass

from ..config import get_settings
from ..game.answers import check_answers
from ..logging_config import get_logger
from ..ws.connection import ConnectionHub
from ..ws.protocol import ServerMessage
from .broadcasting import RoomBroadcaster
from .item_engine import ItemEngine
from .models import Player, Room, RoomState
from .scoring import compute_score, hint_cost_units
from .store import RoomStore
from .theme_vote import ThemeVote

log = get_logger(__name__)

# Marge apres la fin du chrono avant cloture forcee par le serveur.
DEADLINE_GRACE_S = 5


@dataclass
class _RoomTasks:
    items: asyncio.Task | None = None
    deadline: asyncio.Task | None = None

    def cancel_all(self) -> None:
        for task in (self.items, self.deadline):
            if task is not None and not task.done():
                task.cancel()
        self.items = None
        self.deadline = None


class RoomService:
    def __init__(self, store: RoomStore, hub: ConnectionHub, rng: random.Random | None = None):
        self.store = store
        self.hub = hub
        self.rng = rng or random.Random()
        self.broadcaster = RoomBroadcaster(hub)
        self.items = ItemEngine(self.broadcaster, self.rng)
        self.theme_vote = ThemeVote(self.broadcaster, self.rng)
        self._tasks: dict[str, _RoomTasks] = {}

    # ------------------------------------------------------------ raccourcis
    async def broadcast_lobby(self, room: Room) -> None:
        await self.broadcaster.lobby(room)

    async def send_error(
        self, room_code: str, player_name: str, message: str, code: str = "generic"
    ) -> None:
        room = self.store.get(room_code)
        player = room.player(player_name) if room else None
        if room and player:
            await self.broadcaster.error(room, player, message, code)

    def cancel_tasks(self, code: str) -> None:
        self._tasks.pop(code, _RoomTasks()).cancel_all()

    def player_seconds_remaining(self, room: Room, player: Player) -> float:
        """Temps restant propre au joueur : les malus FREEZE_TIME sont
        comptes cote serveur, pas seulement en visuel."""
        return max(0.0, room.seconds_remaining - player.time_malus_s)

    # --------------------------------------------------------------- options
    def apply_options(self, room: Room, duration_s: int | None, with_items: bool | None) -> None:
        cfg = get_settings().rooms
        if duration_s is not None:
            room.duration_s = max(cfg.min_duration_s, min(cfg.max_duration_s, int(duration_s)))
        if with_items is not None:
            room.with_items = bool(with_items)

    # ----------------------------------------------------------------- votes
    async def start_theme_vote(self, room: Room) -> None:
        await self.theme_vote.open(room)

    async def register_theme(self, room: Room, player_name: str, theme: str) -> None:
        if await self.theme_vote.register(room, player_name, theme):
            await self.pick_theme_and_start(room)

    async def pick_theme_and_start(self, room: Room) -> None:
        result = await self.theme_vote.generate(room)
        if result is None:
            return
        theme, game = result
        await self.launch(room, game, theme=theme)

    # ------------------------------------------------------------ demarrage
    async def launch(self, room: Room, game, theme: str) -> None:
        """SEUL point d'entree pour demarrer une partie."""
        room.game = game
        room.state = RoomState.PLAYING
        room.started_at = time.time()
        room.reset_players_for_new_game()

        tasks = self._tasks.setdefault(room.code, _RoomTasks())
        tasks.cancel_all()

        await self.broadcaster.to_room(
            room,
            ServerMessage.GAME_START,
            theme=theme,
            game=game.to_public_dict(),
            players=[p.to_roster_dict() for p in room.players.values()],
            durationS=room.duration_s,
            withItems=room.with_items,
        )

        if room.with_items:
            tasks.items = asyncio.create_task(self.items.distribution_loop(room))
        tasks.deadline = asyncio.create_task(self._deadline(room))

    async def _deadline(self, room: Room) -> None:
        """Filet de securite : cloture la partie meme si des clients ne
        repondent plus (onglet ferme, navigateur endormi)."""
        with contextlib.suppress(asyncio.CancelledError):
            await asyncio.sleep(room.duration_s + DEADLINE_GRACE_S)
            if room.state is not RoomState.PLAYING:
                return
            log.info("Salle %s : temps ecoule, cloture forcee", room.code)
            for player in room.connected_players:
                if not player.answered:
                    self._score_player(room, player)
            await self.finish(room)

    # ----------------------------------------------------------------- items
    async def use_item(
        self, room: Room, player: Player, instance_id: str, targets: list[str]
    ) -> None:
        await self.items.use(room, player, instance_id, targets)

    # --------------------------------------------------------------- indices
    async def unlock_hint(
        self, room: Room, player: Player, target_index: int, level: int = 1
    ) -> None:
        """Le cout est compte cote serveur : le client ne peut plus annuler
        sa penalite d'indice."""
        if room.game is None or room.state is not RoomState.PLAYING:
            return
        if player.hints_locked:
            await self.broadcaster.error(
                room, player, "Vos indices sont brouilles.", "hints_locked"
            )
            return
        if not 1 <= target_index <= room.game.total_fakes:
            return

        level = 2 if level >= 2 else 1
        fake = room.game.solution()[target_index - 1]
        player.hint_levels[target_index] = max(player.hint_levels.get(target_index, 0), level)
        player.hints_used = hint_cost_units(player.hint_levels)

        payload = {"target_index": target_index, "level": level, "hint": fake["hint"]}
        if player.hint_levels[target_index] >= 2:
            payload["paragraph_index"] = fake["paragraph_index"]
            if fake["paragraph_index"] not in player.revealed_indices:
                player.revealed_indices.append(fake["paragraph_index"])

        await self.broadcaster.to_player(room, player, ServerMessage.HINT_UNLOCKED, **payload)
        await self.broadcaster.live_score(room, player)

    # -------------------------------------------------------------- reponses
    async def update_selection(self, room: Room, player: Player, selection: list[int]) -> None:
        if room.state is not RoomState.PLAYING or room.game is None:
            return
        limit = len(room.game.paragraphs)
        player.selection = sorted({i for i in selection if isinstance(i, int) and 1 <= i <= limit})
        await self.broadcaster.live_score(room, player)

    def _score_player(self, room: Room, player: Player) -> None:
        """Fige le score d'un joueur. Point de verite unique du scoring."""
        check = check_answers(player.selection, room.game.fake_indices)
        breakdown = compute_score(
            check,
            seconds_remaining=self.player_seconds_remaining(room, player),
            hints_used=player.hints_used,
            stolen_points=player.stolen_points,
        )
        player.answered = True
        player.score = breakdown.total
        player.breakdown = breakdown.to_dict()

    async def submit_answer(self, room: Room, player: Player, selection: list[int]) -> None:
        if room.game is None or room.state is not RoomState.PLAYING:
            return
        await self.update_selection(room, player, selection)
        self._score_player(room, player)

        await self.broadcaster.to_player(room, player, ServerMessage.ANSWER_ACK, answered=True)
        await self.broadcaster.lobby(room)
        if room.all_connected_answered():
            await self.finish(room)

    async def unsubmit_answer(self, room: Room, player: Player) -> None:
        if room.state is not RoomState.PLAYING:
            return
        player.answered = False
        player.score = 0
        player.breakdown = None
        await self.broadcaster.to_player(room, player, ServerMessage.ANSWER_ACK, answered=False)
        await self.broadcaster.lobby(room)

    async def finish(self, room: Room) -> None:
        if room.state is not RoomState.PLAYING:
            return
        self.cancel_tasks(room.code)
        room.state = RoomState.WAITING
        await self.broadcaster.to_room(
            room,
            ServerMessage.GAME_END,
            leaderboard=room.leaderboard(),
            solution=room.game.solution() if room.game else [],
        )
        for player in room.players.values():
            player.ready = False
        await self.broadcaster.lobby(room)

    # ------------------------------------------------------------------ relais
    async def relay_chat(self, room: Room, player: Player, content: str) -> None:
        limit = get_settings().rooms.max_chat_length
        text = (content or "").strip()[:limit]
        if not text:
            return
        await self.broadcaster.to_room(
            room,
            ServerMessage.CHAT_MESSAGE,
            sender=player.name,
            content=text,
            at=time.time(),
        )

    async def relay_cursor(self, room: Room, player: Player, x: float, y: float) -> None:
        """Debit limite cote serveur : un client modifie ne peut pas saturer
        la salle."""
        min_interval = get_settings().rooms.cursor_min_interval_s
        now = time.time()
        if now - player.last_cursor_at < min_interval:
            return
        player.last_cursor_at = now
        await self.broadcaster.to_room_except(
            room,
            player.name,
            ServerMessage.CURSOR_UPDATE,
            player=player.name,
            x=max(0.0, min(1.0, float(x))),
            y=max(0.0, min(1.0, float(y))),
        )


_service: RoomService | None = None


def get_room_service() -> RoomService:
    global _service
    if _service is None:
        from ..ws.connection import get_hub
        from .store import get_room_store

        _service = RoomService(get_room_store(), get_hub())
    return _service

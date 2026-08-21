"""Distribution et resolution des items.

Les effets qui touchent au score ou au temps sont appliques ICI, cote
serveur : le client ne recoit qu'une notification visuelle.
"""

from __future__ import annotations

import asyncio
import contextlib
import random

from ..config import get_settings
from ..logging_config import get_logger
from ..ws.protocol import ServerMessage
from . import items as catalogue
from .broadcasting import RoomBroadcaster
from .models import ItemInstance, Player, Room, RoomState

log = get_logger(__name__)


class ItemEngine:
    def __init__(self, broadcaster: RoomBroadcaster, rng: random.Random) -> None:
        self.broadcaster = broadcaster
        self.rng = rng

    # ----------------------------------------------------------- distribution
    async def distribution_loop(self, room: Room) -> None:
        """Donne un item aleatoire a chaque joueur a intervalle regulier."""
        cfg = get_settings().rooms
        with contextlib.suppress(asyncio.CancelledError):
            for wave in range(1, cfg.max_item_waves + 1):
                await asyncio.sleep(cfg.item_interval_s)
                if room.state is not RoomState.PLAYING:
                    return
                granted = self._grant_wave(room, wave)
                if granted:
                    await self.broadcaster.to_room(
                        room, ServerMessage.ITEMS_GRANTED, wave=wave, items=granted
                    )

    def _grant_wave(self, room: Room, wave: int) -> dict[str, dict]:
        granted: dict[str, dict] = {}
        for player in room.connected_players:
            definition = catalogue.random_item(self.rng)
            if definition is None:
                continue
            instance = ItemInstance(
                instance_id=f"{player.name}-{wave}-{definition.id}",
                item_id=definition.id,
            )
            player.items.append(instance)
            granted[player.name] = instance.to_dict()
        return granted

    # --------------------------------------------------------------- usage
    async def use(self, room: Room, player: Player, instance_id: str, targets: list[str]) -> None:
        instance = next((i for i in player.items if i.instance_id == instance_id), None)
        if instance is None:
            await self.broadcaster.error(room, player, "Item introuvable.", "unknown_item")
            return
        definition = catalogue.by_id(instance.item_id)
        if definition is None:
            return

        resolved = self._resolve_targets(room, player, definition, targets)
        if resolved is None:
            await self.broadcaster.error(room, player, "Cible invalide.", "bad_target")
            return

        player.items.remove(instance)
        for name in resolved:
            await self._apply(room, definition.id, room.players[name], player.name)

        await self.broadcaster.to_room(
            room,
            ServerMessage.ITEM_USED,
            player=player.name,
            item_id=definition.id,
            targets=resolved,
        )

    def _resolve_targets(
        self, room: Room, player: Player, definition, targets: list[str]
    ) -> list[str] | None:
        if definition.target_count == 0:
            return [player.name]
        valid = [
            name
            for name in targets[: definition.target_count]
            if name in room.players and name != player.name
        ]
        return valid or None

    # -------------------------------------------------------------- effets
    async def _apply(self, room: Room, item_id: str, target: Player, source: str) -> None:
        cfg = get_settings().score
        touches_score = False

        if item_id == "HINT_LOCK":
            definition = catalogue.by_id(item_id)
            duration_s = (definition.duration_ms if definition else 20_000) / 1000
            target.lock_hints_for(duration_s)
        elif item_id == "FREEZE_TIME":
            target.time_malus_s += cfg.time_malus_s
            touches_score = True
        elif item_id == "SCORE_STEAL":
            target.stolen_points += cfg.steal_amount
            touches_score = True
        elif item_id == "SCANNER":
            await self._scan(room, target)

        await self.broadcaster.to_player(
            room, target, ServerMessage.ITEM_EFFECT, item_id=item_id, **{"from": source}
        )
        if touches_score:
            await self.broadcaster.live_score(room, target)

    async def _scan(self, room: Room, target: Player) -> None:
        """Revele au joueur un paragraphe falsifie qu'il n'a pas encore vu."""
        if room.game is None:
            return
        pool = [
            index
            for index in sorted(room.game.fake_indices)
            if index not in target.revealed_indices and index not in target.selection
        ]
        if not pool:
            return
        index = self.rng.choice(pool)
        target.revealed_indices.append(index)
        await self.broadcaster.to_player(
            room, target, ServerMessage.SCANNER_RESULT, paragraph_index=index
        )

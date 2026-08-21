"""Utilisation des items."""

from __future__ import annotations

from ...rooms.models import RoomState
from ..dispatcher import HandlerContext, handler
from ..protocol import ClientMessage


@handler(ClientMessage.USE_ITEM, states=(RoomState.PLAYING,))
async def use_item(ctx: HandlerContext, payload: dict) -> None:
    instance_id = str(payload.get("instanceId", payload.get("instance_id", "")))
    raw_targets = payload.get("targets", [])
    targets = [str(t) for t in raw_targets if isinstance(t, str)][:8]
    if not instance_id:
        return
    await ctx.service.use_item(ctx.room, ctx.player, instance_id, targets)

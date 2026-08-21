"""Phase de vote de theme."""

from __future__ import annotations

from ...rooms.models import RoomState
from ..dispatcher import HandlerContext, handler
from ..protocol import ClientMessage


@handler(ClientMessage.SUBMIT_THEME, states=(RoomState.THEME_VOTING,))
async def submit_theme(ctx: HandlerContext, payload: dict) -> None:
    await ctx.service.register_theme(ctx.room, ctx.player.name, str(payload.get("theme", "")))


@handler(ClientMessage.FORCE_PICK, host_only=True, states=(RoomState.THEME_VOTING,))
async def force_pick(ctx: HandlerContext, payload: dict) -> None:
    """L'hote coupe court au vote. Les themes de secours prennent le relais
    si personne n'a propose quoi que ce soit."""
    await ctx.service.pick_theme_and_start(ctx.room)

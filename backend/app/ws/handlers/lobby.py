"""Salon : liste des joueurs, etat pret, options de partie."""

from __future__ import annotations

from ...rooms.models import RoomState
from ..dispatcher import HandlerContext, handler
from ..protocol import ClientMessage


@handler(ClientMessage.GET_LOBBY)
async def get_lobby(ctx: HandlerContext, payload: dict) -> None:
    await ctx.service.broadcast_lobby(ctx.room)


@handler(ClientMessage.SET_READY, states=(RoomState.WAITING,))
async def set_ready(ctx: HandlerContext, payload: dict) -> None:
    ctx.player.ready = bool(payload.get("ready", True))
    await ctx.service.broadcast_lobby(ctx.room)


@handler(ClientMessage.SET_OPTIONS, host_only=True, states=(RoomState.WAITING,))
async def set_options(ctx: HandlerContext, payload: dict) -> None:
    """Duree et items : decides par l'hote, valides et bornes par le serveur."""
    ctx.service.apply_options(
        ctx.room,
        duration_s=payload.get("durationS"),
        with_items=payload.get("withItems"),
    )
    await ctx.service.broadcast_lobby(ctx.room)


@handler(ClientMessage.START_VOTE, host_only=True, states=(RoomState.WAITING,))
async def start_vote(ctx: HandlerContext, payload: dict) -> None:
    ctx.service.apply_options(
        ctx.room,
        duration_s=payload.get("durationS"),
        with_items=payload.get("withItems"),
    )
    await ctx.service.start_theme_vote(ctx.room)

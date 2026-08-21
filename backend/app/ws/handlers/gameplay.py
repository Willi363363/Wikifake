"""Deroulement de la partie : selection, indices, soumission, curseurs."""

from __future__ import annotations

from ...rooms.models import RoomState
from ..dispatcher import HandlerContext, handler
from ..protocol import ClientMessage


def _selection(payload: dict) -> list[int]:
    raw = payload.get("selection", payload.get("answers", []))
    if not isinstance(raw, list):
        return []
    out: list[int] = []
    for value in raw[:200]:
        try:
            out.append(int(value))
        except (TypeError, ValueError):
            continue
    return out


@handler(ClientMessage.SELECTION_UPDATE, states=(RoomState.PLAYING,))
async def selection_update(ctx: HandlerContext, payload: dict) -> None:
    await ctx.service.update_selection(ctx.room, ctx.player, _selection(payload))


@handler(ClientMessage.SUBMIT_ANSWER, states=(RoomState.PLAYING,))
async def submit_answer(ctx: HandlerContext, payload: dict) -> None:
    await ctx.service.submit_answer(ctx.room, ctx.player, _selection(payload))


@handler(ClientMessage.UNSUBMIT_ANSWER, states=(RoomState.PLAYING,))
async def unsubmit_answer(ctx: HandlerContext, payload: dict) -> None:
    await ctx.service.unsubmit_answer(ctx.room, ctx.player)


@handler(ClientMessage.UNLOCK_HINT, states=(RoomState.PLAYING,))
async def unlock_hint(ctx: HandlerContext, payload: dict) -> None:
    try:
        target = int(payload.get("targetIndex", payload.get("target_index", 0)))
    except (TypeError, ValueError):
        return
    try:
        level = int(payload.get("level", 1))
    except (TypeError, ValueError):
        level = 1
    await ctx.service.unlock_hint(ctx.room, ctx.player, target, level)


@handler(ClientMessage.CURSOR, states=(RoomState.PLAYING,))
async def cursor(ctx: HandlerContext, payload: dict) -> None:
    try:
        x = float(payload.get("x", 0))
        y = float(payload.get("y", 0))
    except (TypeError, ValueError):
        return
    await ctx.service.relay_cursor(ctx.room, ctx.player, x, y)

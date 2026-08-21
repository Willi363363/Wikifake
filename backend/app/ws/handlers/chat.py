"""Chat de salle (disponible dans tous les etats)."""

from __future__ import annotations

from ..dispatcher import HandlerContext, handler
from ..protocol import ClientMessage


@handler(ClientMessage.CHAT_MESSAGE)
async def chat_message(ctx: HandlerContext, payload: dict) -> None:
    await ctx.service.relay_chat(ctx.room, ctx.player, str(payload.get("content", "")))

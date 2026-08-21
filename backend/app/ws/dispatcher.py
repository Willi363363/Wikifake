"""Routage des messages WebSocket.

Ajouter une commande = ecrire une fonction decoree `@handler(...)` dans
`app/ws/handlers/`. Aucun `if/elif` a modifier, aucun fichier existant a
toucher (l'ancien handler faisait 180 lignes de `elif`).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass

from ..logging_config import get_logger
from ..rooms.models import Player, Room, RoomState
from ..rooms.service import RoomService
from .protocol import ClientMessage, ServerMessage, envelope

log = get_logger(__name__)


@dataclass
class HandlerContext:
    """Tout ce dont un handler a besoin, injecte par le dispatcher."""

    room: Room
    player: Player
    service: RoomService

    @property
    def code(self) -> str:
        return self.room.code

    async def error(self, message: str, code: str = "generic") -> None:
        await self.service.send_error(self.room.code, self.player.name, message, code)


Handler = Callable[[HandlerContext, dict], Awaitable[None]]


@dataclass(frozen=True)
class _Registration:
    fn: Handler
    host_only: bool
    states: tuple[RoomState, ...]


_REGISTRY: dict[str, _Registration] = {}


def handler(
    message: ClientMessage,
    *,
    host_only: bool = False,
    states: Iterable[RoomState] | None = None,
):
    """Enregistre un handler pour un type de message.

    `host_only=True` fait respecter le role d'hote **cote serveur** : avant,
    `isHost` etait purement client et n'importe qui pouvait lancer la partie.
    `states` restreint le message a certains etats de salle.
    """

    allowed = tuple(states) if states else ()

    def decorate(fn: Handler) -> Handler:
        if message.value in _REGISTRY:
            raise RuntimeError(f"Handler deja enregistre pour {message.value!r}")
        _REGISTRY[message.value] = _Registration(fn=fn, host_only=host_only, states=allowed)
        return fn

    return decorate


def registered_types() -> list[str]:
    return sorted(_REGISTRY)


async def dispatch(ctx: HandlerContext, message: dict) -> None:
    """Aiguille un message entrant vers son handler."""
    kind = message.get("type")
    if not isinstance(kind, str):
        await ctx.error("Message sans type.", "bad_message")
        return

    registration = _REGISTRY.get(kind)
    if registration is None:
        log.debug("Message inconnu %r ignore (salle %s)", kind, ctx.code)
        await ctx.error(f"Commande inconnue: {kind}", "unknown_command")
        return

    if registration.host_only and not ctx.player.is_host:
        await ctx.error("Seul l'hote peut faire cela.", "not_host")
        return

    if registration.states and ctx.room.state not in registration.states:
        log.debug("Message %r ignore: salle %s en etat %s", kind, ctx.code, ctx.room.state.value)
        return

    payload = message.get("payload")
    if not isinstance(payload, dict):
        # Tolerance : on accepte aussi les champs a plat.
        payload = {k: v for k, v in message.items() if k != "type"}

    try:
        await registration.fn(ctx, payload)
    except Exception:  # noqa: BLE001 - on protege la boucle de reception
        log.exception("Handler %r a echoue (salle %s)", kind, ctx.code)
        await ctx.service.hub.send(
            ctx.code,
            ctx.player.name,
            envelope(
                ServerMessage.ERROR,
                message="Une erreur interne est survenue.",
                code="handler_error",
            ),
        )

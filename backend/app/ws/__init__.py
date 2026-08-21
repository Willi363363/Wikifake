"""Couche WebSocket : transport, protocole, routage des messages."""

from .connection import ConnectionHub, get_hub
from .dispatcher import HandlerContext, dispatch, handler, registered_types

__all__ = [
    "ConnectionHub",
    "get_hub",
    "HandlerContext",
    "dispatch",
    "handler",
    "registered_types",
]

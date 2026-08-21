"""Configuration du logging (remplace les `print` disperses)."""

from __future__ import annotations

import logging
import sys

_CONFIGURED = False


def setup_logging(level: str = "INFO") -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s %(levelname)-7s %(name)-28s %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    root = logging.getLogger("wikifake")
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    root.handlers = [handler]
    root.propagate = False
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """`get_logger(__name__)` depuis n'importe quel module de l'app."""
    short = name.replace("backend.", "").replace("app.", "")
    return logging.getLogger(f"wikifake.{short}")

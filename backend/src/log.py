"""Journalisation de l'application.

Remplace les `print` dispersés : un niveau, un horodatage, un nom de module,
et la possibilité de baisser le bruit en production via `LOG_LEVEL`.

Usage : `log = get_logger(__name__)` puis `log.info(...)`, `log.warning(...)`.
"""
import logging
import os
import sys

_ROOT = "wikifake"
_configured = False


def _configure() -> None:
    global _configured
    if _configured:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(
        fmt="%(asctime)s %(levelname)-7s %(name)-26s %(message)s",
        datefmt="%H:%M:%S",
    ))
    root = logging.getLogger(_ROOT)
    root.setLevel(getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO))
    root.handlers = [handler]
    root.propagate = False
    _configured = True


def get_logger(name: str) -> logging.Logger:
    _configure()
    return logging.getLogger(f"{_ROOT}.{name.removeprefix('src.')}")

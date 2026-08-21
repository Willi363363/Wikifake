"""Persistance des signalements (JSONL append-only)."""

from __future__ import annotations

import json
from pathlib import Path

from ..config import get_settings
from ..logging_config import get_logger
from .models import FlagRecord

log = get_logger(__name__)

FILENAME = "complaints.jsonl"


def _file_path() -> Path:
    data_dir = get_settings().paths.data_dir
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / FILENAME


def append(record: FlagRecord) -> None:
    path = _file_path()
    try:
        with path.open("a", encoding="utf-8") as handle:
            handle.write(record.model_dump_json() + "\n")
    except OSError as exc:
        log.error("Ecriture du signalement impossible (%s): %s", path, exc)


def read_all() -> list[dict]:
    """Lecture utilitaire (moderation, tests)."""
    path = _file_path()
    if not path.exists():
        return []
    rows: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                log.warning("Ligne JSONL illisible ignoree")
    return rows

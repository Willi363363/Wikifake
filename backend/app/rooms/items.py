"""Catalogue d'items, charge depuis `shared/items.json`.

SOURCE UNIQUE partagee avec le frontend (`frontend/src/config/items.js`
importe le meme fichier). Ajouter un item = editer le JSON, rien d'autre
cote backend.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass
from functools import lru_cache

from ..config import get_settings
from ..logging_config import get_logger

log = get_logger(__name__)


@dataclass(frozen=True)
class ItemDefinition:
    id: str
    name: str
    icon: str
    description: str
    target_count: int
    duration_ms: int
    color: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "icon": self.icon,
            "description": self.description,
            "targetCount": self.target_count,
            "durationMs": self.duration_ms,
            "color": self.color,
        }


@lru_cache(maxsize=1)
def catalogue() -> tuple[ItemDefinition, ...]:
    path = get_settings().paths.shared_dir / "items.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        log.error("Catalogue d'items illisible (%s): %s", path, exc)
        return ()
    items = []
    for raw in payload.get("items", []):
        items.append(
            ItemDefinition(
                id=str(raw["id"]),
                name=str(raw.get("name", raw["id"])),
                icon=str(raw.get("icon", "?")),
                description=str(raw.get("description", "")),
                target_count=int(raw.get("targetCount", 1)),
                duration_ms=int(raw.get("durationMs", 0)),
                color=str(raw.get("color", "#27272a")),
            )
        )
    log.info("%d items charges depuis %s", len(items), path.name)
    return tuple(items)


def by_id(item_id: str) -> ItemDefinition | None:
    return next((item for item in catalogue() if item.id == item_id), None)


def random_item(rng: random.Random | None = None) -> ItemDefinition | None:
    items = catalogue()
    if not items:
        return None
    return (rng or random).choice(list(items))

"""Catalogue d'items partage avec le frontend."""

import json

from app.config import get_settings
from app.rooms.items import by_id, catalogue, random_item


def test_catalogue_loads():
    items = catalogue()
    assert len(items) >= 10
    assert all(item.id and item.name and item.icon for item in items)


def test_ids_are_unique():
    ids = [item.id for item in catalogue()]
    assert len(ids) == len(set(ids))


def test_matches_shared_json_exactly():
    path = get_settings().paths.shared_dir / "items.json"
    raw = json.loads(path.read_text(encoding="utf-8"))["items"]
    assert [item.id for item in catalogue()] == [entry["id"] for entry in raw]


def test_scanner_targets_self():
    scanner = by_id("SCANNER")
    assert scanner is not None
    assert scanner.target_count == 0


def test_by_id_unknown():
    assert by_id("DOES_NOT_EXIST") is None


def test_random_item_is_from_catalogue(rng):
    item = random_item(rng)
    assert item in catalogue()

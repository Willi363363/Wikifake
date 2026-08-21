"""ARCHITECTURE.md doit décrire le code réel.

La documentation avait dérivé sans que rien ne le signale : elle décrivait un
générateur partagé supprimé depuis, un panneau de maquettage supprimé lui
aussi, un barème « appliqué des deux côtés » alors que le client ne calcule
plus rien, et il lui manquait quatre messages WebSocket et trois routes.

Ces tests verrouillent ce qui est mécaniquement vérifiable : les listes de
messages, les routes, et les modules cités. La prose reste à la charge du
relecteur.
"""
import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
ROOT = BACKEND.parent
DOC = (ROOT / "ARCHITECTURE.md").read_text(encoding="utf-8")


def _section(start: str, end: str) -> str:
    return DOC[DOC.index(start):DOC.index(end)]


def test_documented_modules_exist():
    for module in set(re.findall(r"`(src/[\w/]+\.py)`", DOC)):
        assert (BACKEND / module).exists(), f"{module} est documenté mais absent"


def test_documented_make_targets_exist():
    makefile = (ROOT / "Makefile").read_text(encoding="utf-8")
    for target in set(re.findall(r"^make ([\w-]+)", DOC, re.M)):
        assert re.search(rf"^{target}:", makefile, re.M), f"cible make {target!r} inexistante"


def test_incoming_ws_messages_match_the_dispatch_table():
    handlers = (BACKEND / "src/realtime/handlers.py").read_text(encoding="utf-8")
    in_code = set(re.findall(r'"([a-z_]+)": handle_', handlers))

    block = _section("Entrants, gérés dans", "réservés à l'hôte")
    in_doc = set(re.findall(r"`([a-z_]+)`", block)) - {"realtime/handlers.py"}

    assert in_code == in_doc, (
        f"non documentés : {sorted(in_code - in_doc)} ; "
        f"documentés mais absents : {sorted(in_doc - in_code)}"
    )


def test_documented_outgoing_ws_messages_are_actually_sent():
    source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (BACKEND / "src/realtime").rglob("*.py")
    )
    block = _section("Sortants :", "### Le barème")
    for name in set(re.findall(r"`([a-z_]+)`", block)):
        assert f'"{name}"' in source, f"{name!r} est documenté mais jamais émis"


def test_rest_routes_match_the_code():
    source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (BACKEND / "src/api").rglob("*.py")
    )
    in_code = set(re.findall(r'@router\.(?:get|post)\("([^"]+)"\)', source))
    in_doc = set(re.findall(r"\| `(/[\w/\-]+)` \|", DOC))

    assert in_code == in_doc, (
        f"non documentées : {sorted(in_code - in_doc)} ; "
        f"documentées mais absentes : {sorted(in_doc - in_code)}"
    )


def test_doc_does_not_mention_removed_things():
    """Régression : ces éléments ont été supprimés, la doc les décrivait encore."""
    for gone in ("vendor/tweaks", "FakeNewsGame` partagée", "des deux côtés"):
        assert gone not in DOC, f"{gone!r} n'existe plus mais reste documenté"

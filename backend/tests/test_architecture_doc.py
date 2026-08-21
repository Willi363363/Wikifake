"""The current-state documentation must describe the real code.

The documentation had drifted with nothing to signal it: it described a shared
generator that had been removed, a mock-up panel removed as well, a scoring
table "applied on both sides" when the client no longer computes anything, and
it was missing four WebSocket messages and three routes.

These tests lock what is mechanically verifiable: the message lists, the
routes, and the modules cited. Prose remains the reviewer's job.
"""
import re
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
ROOT = BACKEND.parent

# Documentation lives in plans/, split into files of at most 200 lines (see
# plans/method/02-repository-rules.md). The lock covers the whole set: routes
# are in 01-backend.md, WebSocket messages in 03-websocket-protocol.md, make
# targets in 00-overview.md.
DOC = "\n".join(
    path.read_text(encoding="utf-8")
    for path in sorted((ROOT / "plans" / "current-state").glob("*.md"))
)


def _section(start: str, end: str) -> str:
    return DOC[DOC.index(start):DOC.index(end)]


def test_documented_modules_exist():
    for module in set(re.findall(r"`(src/[\w/]+\.py)`", DOC)):
        assert (BACKEND / module).exists(), f"{module} is documented but missing"


def test_documented_make_targets_exist():
    makefile = (ROOT / "Makefile").read_text(encoding="utf-8")
    for target in set(re.findall(r"^make ([\w-]+)", DOC, re.MULTILINE)):
        assert re.search(rf"^{target}:", makefile, re.MULTILINE), f"make target {target!r} does not exist"


def test_incoming_ws_messages_match_the_dispatch_table():
    handlers = (BACKEND / "src/realtime/handlers.py").read_text(encoding="utf-8")
    in_code = set(re.findall(r'"([a-z_]+)": handle_', handlers))

    block = _section("Incoming, handled in", "host-only")
    in_doc = set(re.findall(r"`([a-z_]+)`", block)) - {"realtime/handlers.py"}

    assert in_code == in_doc, (
        f"undocumented: {sorted(in_code - in_doc)}; "
        f"documented but missing: {sorted(in_doc - in_code)}"
    )


def test_documented_outgoing_ws_messages_are_actually_sent():
    source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (BACKEND / "src/realtime").rglob("*.py")
    )
    block = _section("Outgoing:", "### Scoring")
    for name in set(re.findall(r"`([a-z_]+)`", block)):
        assert f'"{name}"' in source, f"{name!r} is documented but never sent"


def test_rest_routes_match_the_code():
    source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (BACKEND / "src/api").rglob("*.py")
    )
    in_code = set(re.findall(r'@router\.(?:get|post)\("([^"]+)"\)', source))
    in_doc = set(re.findall(r"\| `(/[\w/\-]+)` \|", DOC))

    assert in_code == in_doc, (
        f"undocumented: {sorted(in_code - in_doc)}; "
        f"documented but missing: {sorted(in_doc - in_code)}"
    )


def test_doc_does_not_mention_removed_things():
    """Regression: these were removed, the documentation still described them."""
    for gone in ("vendor/tweaks", "shared `FakeNewsGame`", "on both sides"):
        assert gone not in DOC, f"{gone!r} no longer exists but is still documented"

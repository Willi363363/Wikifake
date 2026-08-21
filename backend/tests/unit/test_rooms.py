"""Salles : creation, arrivees/departs, hote, nettoyage."""

import time

import pytest

from app.config import get_settings
from app.rooms.models import RoomState
from app.rooms.store import (
    InvalidNameError,
    NameTakenError,
    RoomFullError,
    RoomStore,
    validate_player_name,
)


@pytest.fixture
def store() -> RoomStore:
    return RoomStore()


def test_codes_are_unique_and_sized(store):
    codes = {store.create().code for _ in range(30)}
    assert len(codes) == 30
    assert all(len(code) == get_settings().rooms.code_length for code in codes)


def test_first_player_becomes_host(store):
    room = store.create()
    alice = store.join(room, "alice")
    bob = store.join(room, "bob")
    assert alice.is_host is True
    assert bob.is_host is False


def test_host_is_transferred_on_departure(store):
    room = store.create()
    store.join(room, "alice")
    bob = store.join(room, "bob")
    store.leave(room, "alice")
    assert bob.is_host is True
    assert room.host is bob


def test_duplicate_connected_name_is_refused(store):
    room = store.create()
    store.join(room, "alice")
    with pytest.raises(NameTakenError):
        store.join(room, "alice")


def test_reconnect_keeps_score_during_game(store):
    room = store.create()
    alice = store.join(room, "alice")
    store.join(room, "bob")
    room.state = RoomState.PLAYING
    alice.score = 420
    store.leave(room, "alice")
    assert alice.connected is False
    assert "alice" in room.players  # conserve pendant la partie
    again = store.join(room, "alice")
    assert again is alice
    assert again.score == 420
    assert again.connected is True


def test_leaving_before_start_removes_the_player(store):
    room = store.create()
    store.join(room, "alice")
    store.leave(room, "alice")
    assert "alice" not in room.players


def test_room_is_full(store):
    room = store.create()
    for i in range(get_settings().rooms.max_players):
        store.join(room, f"p{i}")
    with pytest.raises(RoomFullError):
        store.join(room, "un-de-trop")


def test_cannot_join_a_running_game(store):
    room = store.create()
    store.join(room, "alice")
    room.state = RoomState.PLAYING
    from app.rooms.store import RoomError

    with pytest.raises(RoomError):
        store.join(room, "bob")


@pytest.mark.parametrize("bad", ["", "   ", "x" * 100, "bad<name>", "a\nb"])
def test_invalid_names(bad):
    with pytest.raises(InvalidNameError):
        validate_player_name(bad)


@pytest.mark.parametrize("good", ["alice", "Jean-Luc", "p_1", "Marie Curie", "él.ve"])
def test_valid_names(good):
    assert validate_player_name(f" {good} ") == good


def test_empty_rooms_are_collected(store, monkeypatch):
    room = store.create()
    store.join(room, "alice")
    store.leave(room, "alice")
    assert room.is_empty
    room.empty_since = time.time() - 10_000
    assert store.collect_expired() == 1
    assert store.get(room.code) is None


def test_recent_empty_rooms_survive(store):
    room = store.create()
    assert store.collect_expired() == 0
    assert store.get(room.code) is not None


def test_colors_are_distinct(store):
    room = store.create()
    colors = {store.join(room, f"p{i}").color for i in range(6)}
    assert len(colors) == 6


def test_leaderboard_is_sorted(store):
    room = store.create()
    a = store.join(room, "a")
    b = store.join(room, "b")
    a.score, b.score = 10, 99
    assert [row["name"] for row in room.leaderboard()] == ["b", "a"]


def test_seconds_remaining_outside_game(store):
    room = store.create()
    assert room.seconds_remaining == float(room.duration_s)

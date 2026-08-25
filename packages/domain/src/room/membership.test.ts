import { describe, expect, it } from 'vitest';
import { serverMessages } from '@wikifake/protocol';

import { lobbyUpdate } from './lobby.js';
import { reduceRoom } from './reduce.js';
import { broadcasts, joined, refusal, run } from './scenario.js';
import { emptyRoom, hostOf, PLAYER_COLOURS } from './state.js';

describe('arriving', () => {
  it('adds the player and announces the roster', () => {
    const { state, effects } = run(joined('ada'));
    expect(state.players.map((player) => player.name)).toEqual(['ada']);
    expect(broadcasts(effects)).toEqual([
      {
        type: 'lobby_update',
        players: [
          {
            name: 'ada',
            colour: PLAYER_COLOURS[0],
            connected: true,
            ready: false,
            answered: false,
            isHost: true,
          },
        ],
      },
    ]);
  });

  it('hands out a distinct colour to each arrival', () => {
    const { state } = run(joined('ada', 'bob', 'cyd'));
    expect(state.players.map((player) => player.colour)).toEqual([
      PLAYER_COLOURS[0],
      PLAYER_COLOURS[1],
      PLAYER_COLOURS[2],
    ]);
  });

  // D5 — freed by an **eviction**, which is what a departure is now. A dropped
  // socket keeps the seat and the colour with it: the player may be back.
  it('reuses a colour freed by a departure rather than cycling past it', () => {
    const { state } = run([
      ...joined('ada', 'bob'),
      { kind: 'evict', player: 'ada' },
      ...joined('cyd'),
    ]);
    expect(state.players.map((player) => player.colour)).toEqual([
      PLAYER_COLOURS[1],
      PLAYER_COLOURS[0],
    ]);
  });

  // C5.2 — the player already in place keeps their seat, their colour and
  // anything they have paid for.
  it('refuses a duplicate nickname without touching the player in place', () => {
    const first = run(joined('ada'));
    const second = reduceRoom(first.state, { kind: 'join', player: 'ada' });
    expect(refusal(second.effects)).toBe('name_taken');
    expect(second.state).toBe(first.state);
  });

  it('produces a roster the protocol accepts', () => {
    const { state } = run(joined('ada', 'bob'));
    expect(serverMessages.lobbyUpdate.safeParse(lobbyUpdate(state)).success).toBe(true);
  });
});

describe('C1.8 — the host', () => {
  it('is the first to arrive', () => {
    const { state } = run(joined('ada', 'bob'));
    expect(hostOf(state)).toBe('ada');
  });

  it('passes to the next player when they are evicted', () => {
    const { state } = run([
      ...joined('ada', 'bob', 'cyd'),
      { kind: 'evict', player: 'ada' },
    ]);
    expect(hostOf(state)).toBe('bob');
  });

  // D5 — a host whose connection dropped is still the host. Promoting on a
  // network hiccup hands the room to somebody else and takes it back a second
  // later, which is worse than waiting out the grace window.
  it('stays with a host whose socket merely dropped', () => {
    const { state } = run([...joined('ada', 'bob'), { kind: 'leave', player: 'ada' }]);
    expect(hostOf(state)).toBe('ada');
  });

  it('does not change when a guest is evicted', () => {
    const { state } = run([...joined('ada', 'bob'), { kind: 'evict', player: 'bob' }]);
    expect(hostOf(state)).toBe('ada');
  });

  it('is nobody in an empty room', () => {
    expect(hostOf(emptyRoom())).toBe(null);
  });
});

// D5 — a dropped socket is not a departure. The current server deletes the
// player, so their score, their items and the hints they paid for go with them,
// and their nickname is immediately claimable by a stranger.
describe('losing a socket', () => {
  it('keeps the player, marked disconnected', () => {
    const { state } = run([...joined('ada', 'bob'), { kind: 'leave', player: 'ada' }]);

    expect(state.players.map((player) => player.name)).toEqual(['ada', 'bob']);
    expect(state.players.map((player) => player.connected)).toEqual([false, true]);
  });

  it('tells the room, so a rival can see who is away', () => {
    const { effects } = run([...joined('ada', 'bob'), { kind: 'leave', player: 'ada' }]);
    const [last] = broadcasts(effects).slice(-1);

    expect(last).toMatchObject({
      type: 'lobby_update',
      players: [
        { name: 'ada', connected: false },
        { name: 'bob', connected: true },
      ],
    });
  });

  // The room is not empty: its only player may be reconnecting. Closing it here
  // would throw a round away over a network hiccup.
  it('does not close a room whose last player merely dropped', () => {
    const { state, effects } = run([...joined('ada'), { kind: 'leave', player: 'ada' }]);

    expect(state.players.map((player) => player.name)).toEqual(['ada']);
    expect(effects.some((effect) => effect.kind === 'close_room')).toBe(false);
  });

  it('does nothing for someone who was never there', () => {
    const before = run(joined('ada'));
    const after = reduceRoom(before.state, { kind: 'leave', player: 'zoe' });
    expect(after.state).toBe(before.state);
    expect(after.effects).toEqual([]);
  });

  it('does nothing twice over', () => {
    const once = run([...joined('ada', 'bob'), { kind: 'leave', player: 'ada' }]);
    const twice = reduceRoom(once.state, { kind: 'leave', player: 'ada' });
    expect(twice.state).toBe(once.state);
    expect(twice.effects).toEqual([]);
  });
});

// The criterion of step 5.5, as a rule: what a player had is still theirs.
describe('coming back', () => {
  it('reclaims the seat, the colour and everything earned', () => {
    const dropped = run([...joined('ada', 'bob'), { kind: 'leave', player: 'ada' }]);
    const back = reduceRoom(dropped.state, { kind: 'join', player: 'ada' });

    const ada = back.state.players.find((player) => player.name === 'ada');
    expect(ada?.connected).toBe(true);
    expect(ada?.colour).toBe(PLAYER_COLOURS[0]);
    // Their seat: the order is what decides the host, so a reconnection that
    // appended them would quietly demote them.
    expect(back.state.players.map((player) => player.name)).toEqual(['ada', 'bob']);
    expect(hostOf(back.state)).toBe('ada');
  });

  // C5.2 still holds for a player who is actually there.
  it('is still refused while the socket is up', () => {
    const held = run(joined('ada'));
    const again = reduceRoom(held.state, { kind: 'join', player: 'ada' });

    expect(refusal(again.effects)).toBe('name_taken');
    expect(again.state).toBe(held.state);
  });
});

describe('being evicted', () => {
  it('closes the room with its last player', () => {
    const { state, effects } = run([...joined('ada'), { kind: 'evict', player: 'ada' }]);
    expect(state.players).toEqual([]);
    expect(effects).toEqual([{ kind: 'close_room' }]);
  });

  it('does nothing for someone who was never there', () => {
    const before = run(joined('ada'));
    const after = reduceRoom(before.state, { kind: 'evict', player: 'zoe' });
    expect(after.state).toBe(before.state);
    expect(after.effects).toEqual([]);
  });
});

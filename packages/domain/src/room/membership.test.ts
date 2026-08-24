import { describe, expect, it } from 'vitest';
import { serverMessages } from '@wikifake/protocol';

import { lobbyUpdate, reduceLobby } from './lobby.js';
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

  it('reuses a colour freed by a departure rather than cycling past it', () => {
    const { state } = run([
      ...joined('ada', 'bob'),
      { kind: 'leave', player: 'ada' },
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
    const second = reduceLobby(first.state, { kind: 'join', player: 'ada' });
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

  it('passes to the next player when they leave', () => {
    const { state } = run([
      ...joined('ada', 'bob', 'cyd'),
      { kind: 'leave', player: 'ada' },
    ]);
    expect(hostOf(state)).toBe('bob');
  });

  it('does not change when a guest leaves', () => {
    const { state } = run([...joined('ada', 'bob'), { kind: 'leave', player: 'bob' }]);
    expect(hostOf(state)).toBe('ada');
  });

  it('is nobody in an empty room', () => {
    expect(hostOf(emptyRoom())).toBe(null);
  });
});

describe('leaving', () => {
  it('closes the room with its last player', () => {
    const { state, effects } = run([...joined('ada'), { kind: 'leave', player: 'ada' }]);
    expect(state.players).toEqual([]);
    expect(effects).toEqual([{ kind: 'close_room' }]);
  });

  it('does nothing for someone who was never there', () => {
    const before = run(joined('ada'));
    const after = reduceLobby(before.state, { kind: 'leave', player: 'zoe' });
    expect(after.state).toBe(before.state);
    expect(after.effects).toEqual([]);
  });
});

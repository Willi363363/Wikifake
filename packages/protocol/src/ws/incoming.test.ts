import { describe, expect, it } from 'vitest';

import { decode } from '../decode.js';
import * as client from './incoming.js';
import { INCOMING_TYPES, incomingMessage } from './incoming.js';

/**
 * One valid message per dispatch entry, minimal.
 *
 * This map is what ties the union, the announced catalogue and the tests
 * together: a message added to one without the others fails the completeness
 * test below.
 */
const VALID: Readonly<Record<string, unknown>> = {
  set_ready: { type: 'set_ready', ready: true, withItems: true, timeLimit: 180 },
  get_lobby: { type: 'get_lobby' },
  force_start: { type: 'force_start', withItems: false, timeLimit: 300 },
  submit_theme: { type: 'submit_theme', topic: 'Château de Versailles' },
  force_pick: { type: 'force_pick' },
  start_game: { type: 'start_game', topic: 'Paris' },
  live_score: { type: 'live_score', score: -40 },
  cursor: { type: 'cursor', x: 0.5, y: 0.25 },
  chat_message: { type: 'chat_message', content: 'bien joué' },
  use_item: {
    type: 'use_item',
    instanceId: 'ada_1_SCANNER',
    targets: ['bob'],
    marked: [2, 5],
  },
  unlock_hint: { type: 'unlock_hint', falseInfoNumber: 2, level: 2 },
  unsubmit_answer: { type: 'unsubmit_answer' },
  submit_answer: { type: 'submit_answer', marked: [1, 4, 7] },
};

describe('the inbound catalogue', () => {
  it('announces thirteen messages', () => {
    expect(INCOMING_TYPES).toHaveLength(13);
  });

  it('has a valid fixture for every announced type, and no fixture beyond them', () => {
    expect(Object.keys(VALID).sort()).toEqual([...INCOMING_TYPES].sort());
  });

  it.each(Object.entries(VALID))('accepts %s', (_type, message) => {
    const result = decode(incomingMessage, message);
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });

  // C5.3 — an unknown type is ignored by the server, never fatal. The rejection
  // has to point at `type` so the caller can tell "I do not know this message"
  // from "this message is malformed".
  it('rejects an unknown type, pointing at the discriminant', () => {
    const result = decode(incomingMessage, { type: 'drop_table' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/^type: /);
  });

  it('rejects a message with no type at all', () => {
    expect(decode(incomingMessage, {}).ok).toBe(false);
    expect(decode(incomingMessage, null).ok).toBe(false);
    expect(decode(incomingMessage, '"set_ready"').ok).toBe(false);
  });
});

describe('defaults', () => {
  it('reads a bare set_ready as ready, like the current server does', () => {
    expect(client.setReady.parse({ type: 'set_ready' })).toEqual({
      type: 'set_ready',
      ready: true,
    });
  });

  it('leaves the round options absent when they are absent', () => {
    // The distinction matters: a guest's set_ready must not reset the room's
    // options to a default. Step 1.8 relies on the key being missing.
    const parsed = client.setReady.parse({ type: 'set_ready', ready: false });
    expect('withItems' in parsed).toBe(false);
    expect('timeLimit' in parsed).toBe(false);
  });

  it('defaults use_item.marked to an empty list', () => {
    expect(
      client.useItem.parse({ type: 'use_item', instanceId: 'i', targets: [] }),
    ).toEqual({
      type: 'use_item',
      instanceId: 'i',
      targets: [],
      marked: [],
    });
  });

  it('defaults a hint request to level 1', () => {
    expect(client.unlockHint.parse({ type: 'unlock_hint', falseInfoNumber: 1 })).toEqual({
      type: 'unlock_hint',
      falseInfoNumber: 1,
      level: 1,
    });
  });
});

describe('what a client can no longer say', () => {
  // C1.3 — `hintsUsed`, `hintPenalty` and `scoreStolen` used to arrive here and
  // were taken at face value: sending zero cleared your penalties. They are
  // server state now, and the schema drops them rather than trusting them.
  it('drops a self-declared penalty from a submission', () => {
    const parsed = client.submitAnswer.parse({
      type: 'submit_answer',
      marked: [1],
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: -100_000,
    });
    expect(parsed).toEqual({ type: 'submit_answer', marked: [1] });
  });

  it('refuses a start with no topic', () => {
    const result = decode(client.startGame, { type: 'start_game' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/^topic: /);
  });

  it('refuses an absurd round length, naming the field', () => {
    const result = decode(client.forceStart, { type: 'force_start', timeLimit: 86_400 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/^timeLimit: /);
  });

  it('refuses a 0-based paragraph in a submission', () => {
    const result = decode(client.submitAnswer, { type: 'submit_answer', marked: [0, 1] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/^marked\.0: /);
  });

  it('refuses a target whose name could not be a player', () => {
    const result = decode(client.useItem, {
      type: 'use_item',
      instanceId: 'i',
      targets: ['../../etc/passwd'],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]).toMatch(/^targets\.0: /);
  });
});

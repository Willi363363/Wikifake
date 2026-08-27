// What delivery does to a socket that has stopped keeping up.
//
// `broadcast.test.ts` proves the other half of the criterion over real sockets:
// a stalled reader does not delay anybody, because `send` appends to a buffer
// and returns. This is the rule that stops that buffer growing for ever, and it
// is tested here rather than there because the kernel's own send buffer absorbs
// tens of kilobytes before `bufferedAmount` moves — provoking it through a real
// socket would mean pushing megabytes through a suite to prove a comparison.
import { describe, expect, it } from 'vitest';

import { createRegistry } from './connections.js';
import { deliverLocally, readEnvelope, SOCKET_BUDGET_BYTES } from './effects.js';
import type { Connection } from './connections.js';
import type { OutgoingMessage } from '@wikifake/protocol';

const ROOM = 'A1B2C3';

interface Fake extends Connection {
  readonly sent: string[];
  buffered: number;
  terminated: boolean;
}

/** A connection whose backlog a test can decide. */
function fake(playerName: string, buffered = 0, roomCode = ROOM): Fake {
  const connection: Fake = {
    roomCode,
    playerName,
    sent: [],
    buffered,
    terminated: false,
    send: (payload) => connection.sent.push(payload),
    close: () => undefined,
    bufferedBytes: () => connection.buffered,
    terminate: () => {
      connection.terminated = true;
    },
  };
  return connection;
}

/** A real message off the contract: delivery must not care which one it is. */
const lobby: OutgoingMessage = { type: 'lobby_update', players: [] };

describe('delivering one envelope', () => {
  it('sends a broadcast to every socket in the room', () => {
    const connections = createRegistry();
    const ada = fake('ada');
    const bob = fake('bob');
    const elsewhere = fake('carol', 0, 'D4E5F6');
    for (const connection of [ada, bob, elsewhere]) connections.add(connection);

    deliverLocally({ connections }, ROOM, { to: null, message: lobby });

    expect(ada.sent).toHaveLength(1);
    expect(bob.sent).toHaveLength(1);
    // Another room hears nothing, however many instances are listening.
    expect(elsewhere.sent).toEqual([]);
  });

  // C1.1 — a message meant for one player reaches one socket. A targeted send
  // that fell back to a broadcast would put an error, or a hint, in front of
  // the whole room.
  it('sends a targeted message to one socket only', () => {
    const connections = createRegistry();
    const ada = fake('ada');
    const bob = fake('bob');
    connections.add(ada);
    connections.add(bob);

    deliverLocally({ connections }, ROOM, { to: 'bob', message: lobby });

    expect(ada.sent).toEqual([]);
    expect(bob.sent).toHaveLength(1);
  });

  it('drops a targeted message for a player this instance does not hold', () => {
    const connections = createRegistry();
    const ada = fake('ada');
    connections.add(ada);

    deliverLocally({ connections }, ROOM, { to: 'somebody-else', message: lobby });

    expect(ada.sent).toEqual([]);
  });
});

describe('the per-socket budget', () => {
  it('leaves a socket that is keeping up alone', () => {
    const connections = createRegistry();
    const ada = fake('ada', SOCKET_BUDGET_BYTES - 1);
    connections.add(ada);

    deliverLocally({ connections }, ROOM, { to: null, message: lobby });

    expect(ada.terminated).toBe(false);
    expect(connections.holds(ROOM, 'ada')).toBe(true);
  });

  // Cut at the moment of failure rather than left to grow. Without a close
  // handshake: nobody is reading it, so waiting for one waits for ever.
  it('cuts and forgets a socket past its budget', () => {
    const connections = createRegistry();
    const ada = fake('ada', 10);
    connections.add(ada);

    deliverLocally({ connections, budgetBytes: 5 }, ROOM, { to: null, message: lobby });

    expect(ada.terminated).toBe(true);
    expect(connections.holds(ROOM, 'ada')).toBe(false);
  });

  // Written to first, judged after: the message that pushed a socket over is
  // still handed to it. Judging first would drop a message from a socket that
  // was about to be cut anyway, which is the kind of difference that only shows
  // up as a player missing the last thing they were told.
  it('sends the message that pushed it over before cutting', () => {
    const connections = createRegistry();
    const ada = fake('ada', 10);
    connections.add(ada);

    deliverLocally({ connections, budgetBytes: 5 }, ROOM, { to: null, message: lobby });

    expect(ada.sent).toHaveLength(1);
  });

  // The half the criterion is about: one player's stalled connection is not the
  // room's problem.
  it('does not stop the sockets after it in the room', () => {
    const connections = createRegistry();
    const stalled = fake('ada', 10);
    const reading = fake('bob');
    connections.add(stalled);
    connections.add(reading);

    const evicted: string[] = [];
    deliverLocally(
      {
        connections,
        budgetBytes: 5,
        onEvicted: (connection) => evicted.push(connection.playerName),
      },
      ROOM,
      { to: null, message: lobby },
    );

    expect(reading.sent).toHaveLength(1);
    expect(reading.terminated).toBe(false);
    expect(evicted).toEqual(['ada']);
  });
});

describe('an envelope off the channel', () => {
  it('reads one this service wrote', () => {
    expect(readEnvelope(JSON.stringify({ to: null, message: lobby }))).toEqual({
      to: null,
      message: lobby,
    });
  });

  // Only this service publishes here, so an unreadable payload is a bug rather
  // than an attack — and delivering `undefined` to every socket in the room
  // would be a worse way to find out.
  it('refuses one that is not', () => {
    expect(readEnvelope('{ not json')).toBeNull();
    expect(readEnvelope('"a string"')).toBeNull();
    expect(readEnvelope(JSON.stringify({ to: 'ada' }))).toBeNull();
  });
});

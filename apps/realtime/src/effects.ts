// Carrying out what the reducer decided.
//
// The rules return effects as values and never apply them, which is what lets a
// round be tested without a socket. This is the other half, in two halves of its
// own: an effect is **published** to the room's channel, and every instance
// listening on it **delivers** to the sockets it happens to hold. Nobody has to
// know where anybody is connected.
//
// The publisher hears its own messages, so there is exactly one delivery path.
// A "send locally, and also publish for the others" shortcut would double every
// message for the instance that produced it, or need a marker that whoever
// touches this next has to remember.
//
// Two of the six effects belong to steps that do not exist yet —
// `generate_article` needs the article pipeline, `arm_timer` and `cancel_timer`
// need BullMQ — and `close_room` is carried by the store, which deletes the key
// under the same revision guard. Handing those on rather than ignoring them is
// the difference between a seam and a silent hole.
import type { RoomEffect } from '@wikifake/domain';
import type { OutgoingMessage } from '@wikifake/protocol';

import type { Bus } from './bus.js';
import type { Connection, Registry } from './connections.js';

/**
 * How much a socket may have queued before it is considered gone.
 *
 * `send` never blocks — it appends to a buffer — so one stalled reader already
 * does not delay the others. What it does do is grow that buffer until the
 * process runs out of memory, and a fleet where any one player can do that is a
 * fleet with an availability bug rather than a slow player.
 *
 * A quarter of a megabyte is far more than a room produces in the seconds a
 * network hiccup lasts, and far less than it takes to matter.
 */
export const SOCKET_BUDGET_BYTES = 256 * 1024;

/** What crosses the channel: a message, and who it is for. */
export interface Envelope {
  /** A player's nickname for a targeted message, `null` for the whole room. */
  readonly to: string | null;
  readonly message: OutgoingMessage;
}

/** `wikifake:channel:A1B2C3` — one per room, and per namespace. */
export function channelFor(namespace: string, roomCode: string): string {
  return `${namespace}:channel:${roomCode}`;
}

export interface Publisher {
  readonly bus: Bus;
  readonly namespace: string;
  /**
   * Effects this service has nowhere to send. Step 5.4 takes the timers, and
   * the article pipeline takes `generate_article`.
   *
   * Called rather than logged, so the gap is a fact a test can assert on.
   */
  onUnhandled?: (roomCode: string, effect: RoomEffect) => void;
}

/**
 * Publishes what the rules decided, and hands on what it cannot carry.
 *
 * Nothing is sent to a socket here. Everything goes through the channel, even
 * for a player connected to this very process.
 */
export async function publish(
  publisher: Publisher,
  roomCode: string,
  effects: readonly RoomEffect[],
): Promise<void> {
  const channel = channelFor(publisher.namespace, roomCode);

  for (const effect of effects) {
    switch (effect.kind) {
      case 'broadcast':
        await publisher.bus.publish(
          channel,
          JSON.stringify({ to: null, message: effect.message } satisfies Envelope),
        );
        break;

      // C1.1 — a message meant for one player crosses the channel addressed to
      // them, and every instance drops it unless it holds their socket. A
      // targeted message that fell back to a broadcast would send an error, or a
      // hint, to the whole room.
      case 'send':
        await publisher.bus.publish(
          channel,
          JSON.stringify({ to: effect.to, message: effect.message } satisfies Envelope),
        );
        break;

      // Carried by the store, which deletes the key under the revision the
      // decision was taken against. Nothing to send.
      case 'close_room':
        break;

      case 'generate_article':
      case 'arm_timer':
      case 'cancel_timer':
        publisher.onUnhandled?.(roomCode, effect);
        break;
    }
  }
}

export interface LocalDelivery {
  readonly connections: Registry;
  readonly budgetBytes?: number;
  /** Told when a socket is cut for falling too far behind. */
  onEvicted?: (connection: Connection) => void;
}

/** An envelope Redis handed back, or null if it is not one. */
export function readEnvelope(payload: string): Envelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as Partial<Envelope>;

  return typeof candidate.message === 'object' && candidate.message !== null
    ? (parsed as Envelope)
    : null;
}

/**
 * Hands one envelope to the sockets this instance holds.
 *
 * Every socket is written to before any of them is judged, which is what "the
 * blocked socket does not delay the others" means in practice: `send` appends to
 * a buffer and returns, so the loop never waits on the network. The budget is
 * checked **after** the write, so a socket that has fallen behind is cut on the
 * message that pushed it over rather than on the next one.
 */
export function deliverLocally(
  delivery: LocalDelivery,
  roomCode: string,
  envelope: Envelope,
): void {
  const budget = delivery.budgetBytes ?? SOCKET_BUDGET_BYTES;
  const payload = JSON.stringify(envelope.message);

  for (const connection of delivery.connections.in(roomCode)) {
    if (envelope.to !== null && connection.playerName !== envelope.to) continue;

    connection.send(payload);

    if (connection.bufferedBytes() > budget) {
      // Evicted at the moment of failure, rather than left to grow. The socket
      // is cut without a close handshake: nobody is reading it, so waiting for
      // one is waiting for ever.
      delivery.connections.remove(connection);
      connection.terminate();
      delivery.onEvicted?.(connection);
    }
  }
}

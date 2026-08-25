// Carrying out what the reducer decided.
//
// The rules return effects as values and never apply them, which is what lets a
// round be tested without a socket. This is the other half: the values become
// sends, and the ones this step cannot carry yet are handed on rather than
// dropped.
//
// Two of the six belong to steps that do not exist yet — `generate_article`
// needs the article pipeline wired in, `arm_timer` and `cancel_timer` need
// BullMQ — and `close_room` is carried by the store, which deletes the key under
// the same revision guard. Passing the rest to `unhandled` rather than ignoring
// them is the difference between a seam and a silent hole: a test can see
// exactly which effects are still on the floor.
import type { RoomEffect } from '@wikifake/domain';

import type { Registry } from './connections.js';

export interface Delivery {
  readonly connections: Registry;
  /**
   * Effects this step has nowhere to send. Steps 5.3 and 5.4 take them.
   *
   * Called rather than logged, so the gap is a fact a test can assert on.
   */
  onUnhandled?: (roomCode: string, effect: RoomEffect) => void;
}

/**
 * Sends every effect it can, and hands on the rest.
 *
 * Delivery is **to the sockets this instance holds**. That is the naive version
 * on purpose: it is what a single-instance deployment needs, and step 5.3
 * replaces it with a Redis channel per room so any instance serves any socket.
 * Until then a room split across two instances only hears half of itself, which
 * the sheet says out loud rather than leaving to be discovered.
 */
export function deliver(
  delivery: Delivery,
  roomCode: string,
  effects: readonly RoomEffect[],
): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'broadcast': {
        const payload = JSON.stringify(effect.message);
        for (const connection of delivery.connections.in(roomCode)) {
          connection.send(payload);
        }
        break;
      }

      case 'send': {
        // C1.1 — a message meant for one player goes to one socket. A `send`
        // that fell back to a broadcast when the player is on another instance
        // would send an error, or a hint, to the whole room.
        const payload = JSON.stringify(effect.message);
        for (const connection of delivery.connections.in(roomCode)) {
          if (connection.playerName === effect.to) connection.send(payload);
        }
        break;
      }

      // Carried by the store, which deletes the key under the revision the
      // decision was taken against. Nothing to send.
      case 'close_room':
        break;

      case 'generate_article':
      case 'arm_timer':
      case 'cancel_timer':
        delivery.onUnhandled?.(roomCode, effect);
        break;
    }
  }
}

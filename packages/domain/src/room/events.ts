// What reaches the room, and what the room asks for in return.
//
// The reducer decides; it does not apply. Every consequence below is a value the
// caller carries out — send this, generate that, forget this room. Phase 5 wires
// them onto sockets, Redis and BullMQ; the rules never learn which.
import type { IncomingMessage, OutgoingMessage } from '@wikifake/protocol';

export type RoomEvent =
  /** A player's socket opened. Transport has already validated the nickname. */
  | { readonly kind: 'join'; readonly player: string }
  /** A player's socket closed. */
  | { readonly kind: 'leave'; readonly player: string }
  /**
   * A validated message from a player.
   *
   * Validated: the reducer receives `IncomingMessage`, so a malformed frame
   * never reaches the rules. Whoever decoded it answers `bad_json` (C5.3).
   */
  | {
      readonly kind: 'message';
      readonly from: string;
      readonly message: IncomingMessage;
      /**
       * Seconds since the round started. Ignored outside a round.
       *
       * The clock is a parameter (see the phase pitfalls): the reducer never
       * reads one, so a round that ends on a timeout is testable without
       * waiting five minutes.
       */
      readonly elapsedSeconds?: number;
      /**
       * A number the caller draws, used where the game is deliberately random —
       * picking one topic out of several proposals.
       *
       * Explicit rather than absent: keeping the draw preserves a rule of the
       * game (the fastest voter does not always win), and keeping it a parameter
       * preserves a testable reducer. `Math.random()` inside would have cost one
       * or the other.
       */
      readonly seed?: number;
    };

export type RoomEffect =
  /** Send to every player in the room. */
  | { readonly kind: 'broadcast'; readonly message: OutgoingMessage }
  /** Send to one player — an error, or something only they may see (C1.1). */
  | { readonly kind: 'send'; readonly to: string; readonly message: OutgoingMessage }
  /**
   * Fetch and falsify an article for this topic.
   *
   * Slow and fallible, hence an effect: the current server does it inline on the
   * event loop in one of its two start paths, which blocks every other room
   * (D3).
   */
  | { readonly kind: 'generate_article'; readonly topic: string }
  /** C1.8 — the last player left. Forget the room and everything attached. */
  | { readonly kind: 'close_room' };

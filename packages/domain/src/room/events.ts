// What reaches the room, and what the room asks for in return.
//
// The reducer decides; it does not apply. Every consequence below is a value the
// caller carries out — send this, generate that, forget this room. Phase 5 wires
// them onto sockets, Redis and BullMQ; the rules never learn which.
import type {
  ArticleView,
  FalsifiedPosition,
  IncomingMessage,
  ItemInstance,
  OutgoingMessage,
} from '@wikifake/protocol';

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
    }
  /**
   * The article asked for by `generate_article` is ready. This is what starts a
   * round — the **only** thing that does (D3).
   */
  | {
      readonly kind: 'article_ready';
      readonly article: ArticleView;
      readonly solution: readonly FalsifiedPosition[];
    }
  /**
   * The article could not be produced. The next candidate is tried, and the
   * room falls back to the lobby when the queue runs out (C3.7).
   */
  | { readonly kind: 'article_failed' }
  /**
   * D4 — the round's clock ran out.
   *
   * The current server never enforces this: `time_limit` is applied by the
   * client alone, so a round nobody submits to stays open for ever.
   */
  | { readonly kind: 'timer_expired' }
  /**
   * A wave of items lands, one instance per player.
   *
   * The instances come in rather than being drawn here: the draw is random and
   * the schedule is a timer, and both belong to the transport of phase 5. What
   * is a rule is that spending one removes it from the hand.
   */
  | {
      readonly kind: 'items_granted';
      readonly wave: number;
      readonly grants: Readonly<Record<string, ItemInstance>>;
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
  | { readonly kind: 'close_room' }
  /**
   * D4 — end the round in this many seconds unless something else ends it first.
   *
   * An effect, not a `setTimeout`: phase 5 puts it on BullMQ, where it survives
   * a redeployment and works across instances. A timer inside the reducer would
   * make a round-end-by-timeout test take five minutes.
   */
  | { readonly kind: 'arm_timer'; readonly seconds: number }
  /** The round ended another way. Drop the pending timer. */
  | { readonly kind: 'cancel_timer' };

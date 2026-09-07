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
  ScoreBreakdown,
} from '@wikifake/protocol';

import type { RoundRecord } from './state.js';

export type RoomEvent =
  /** A player's socket opened. Transport has already validated the nickname. */
  | { readonly kind: 'join'; readonly player: string }
  /**
   * D5 — a player's socket closed.
   *
   * Not a departure. The player stays in the room, marked disconnected, keeping
   * their score, their items and the hints they paid for; `evict` is what
   * removes them once the grace window has run out. The current server deletes
   * them here and loses all three, and frees their nickname for a stranger.
   */
  | { readonly kind: 'leave'; readonly player: string }
  /**
   * The grace window ran out, or the player asked to go.
   *
   * The only thing that removes a player from a room. Kept apart from `leave`
   * because a dropped socket and a departure look identical from the outside and
   * are not the same event — telling them apart is the whole of D5.
   */
  | { readonly kind: 'evict'; readonly player: string }
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
       * When this message was sent, in milliseconds since the epoch.
       *
       * The clock is a parameter (see the phase pitfalls): the reducer never
       * reads one, so a round that ends on a timeout is testable without
       * waiting five minutes. What the rules need is the *elapsed* time, and
       * they work it out from `round.startedAt` — an instant is something the
       * transport can stamp without reading the room first, and seconds since
       * the start is not.
       *
       * Required, and deliberately so: it was optional, nothing supplied it,
       * and every message was decided as though the round had just begun.
       */
      readonly at: number;
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
      /** When the round begins, in milliseconds since the epoch. */
      readonly startedAt: number;
      /**
       * The rows `createGame` opened for this round — step E.3b.1.
       *
       * It ran before this event was raised, so the ids exist by the time the
       * round starts; carrying them here is what lets `endRound` say where the
       * results go without the service reading the room back.
       */
      readonly record: RoundRecord | null;
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
  | { readonly kind: 'cancel_timer' }
  /**
   * Write down what the round came to — step E.3b.1.
   *
   * Emitted by `endRound` and by nothing else, so a round is recorded exactly
   * where it is decided to be over. The service turns it into one
   * `recordSubmission` per player who submitted.
   *
   * Carried as an effect rather than done by the reducer for the reason every
   * other side effect is: the rules are pure, and a reducer that opened a
   * transaction could not be replayed, tested without a database, or run twice
   * against the same state to see whether it agrees with itself.
   *
   * **No timestamp.** `purity.test.ts` holds these rules to reading no clock,
   * and it is right to: the rules decide *what* a round came to, and *when it
   * was written down* is the writer's own instant — which is exactly how the
   * solo path already stamps it, from `submitContext`'s injected `now`.
   *
   * A player who never submitted is **absent** rather than present with a zero.
   * `participant_score_with_submission` forbids a score without a submission,
   * and the leaderboard's zero is a display rule (C2.4) rather than a result:
   * writing it down would turn "did not answer" into "answered and scored
   * nothing", which is a different thing and the one the profile would count.
   */
  | {
      readonly kind: 'record_results';
      readonly gameId: string;
      readonly results: readonly RecordedResult[];
    };

/** One player's round, in the terms `recordSubmission` writes. */
export interface RecordedResult {
  readonly participantId: string;
  readonly marked: readonly number[];
  readonly score: number;
  readonly breakdown: ScoreBreakdown;
  /** Whether it keeps a streak alive — `isPerfectRound`, asked here. */
  readonly perfect: boolean;
}

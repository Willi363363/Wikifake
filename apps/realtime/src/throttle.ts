// C5.5, D6 — how often one socket may send the two messages that are relayed
// without changing anything.
//
// `cursor` and `live_score` are the room's only unbounded traffic: neither
// alters the state, both are rebroadcast to everybody, and both are sent by the
// client on a human gesture. That makes them the amplification vector — one
// modified client saturating a room for everyone else — and the reason C5.5
// asks for a server-side limit rather than trusting the client's own.
//
// The limit is per socket and per type. Per socket because the flood comes from
// one player and must not cost the others their cursors; per type because the
// two have nothing to do with each other, and one budget shared between them
// would let a cursor flood silence a score.
//
// Nothing else is throttled here. Every other message changes the room, and a
// message that changes the room is already bounded by what it costs to send:
// `set_ready` twice is `set_ready` once, and `use_item` spends the item.
import type { IncomingMessage } from '@wikifake/protocol';

/**
 * C5.5 — the cursor's floor, carried over from `CURSOR_MIN_INTERVAL`.
 *
 * Twenty-five positions a second, which is the value the current server ships
 * and therefore the behaviour the contract preserves: a limit loosened during a
 * rewrite is a limit nobody notices has gone.
 */
export const CURSOR_MIN_INTERVAL_MS = 40;

/**
 * D6 — the one the current server does not have at all.
 *
 * Five a second. The message is the sender's own optimistic tally, so it moves
 * when they tick a paragraph; a human does not tick five in a second, and a
 * client that sends more is describing a score nobody asked for.
 */
export const LIVE_SCORE_MIN_INTERVAL_MS = 200;

/** The two message types a socket may send faster than the room can use. */
export type ThrottledType = 'cursor' | 'live_score';

export type Intervals = Readonly<Record<ThrottledType, number>>;

export const DEFAULT_INTERVALS: Intervals = {
  cursor: CURSOR_MIN_INTERVAL_MS,
  live_score: LIVE_SCORE_MIN_INTERVAL_MS,
};

export interface Throttle {
  /**
   * Whether this message goes on to the rules.
   *
   * Reading it is what spends the allowance, so it is asked exactly once per
   * frame. A message of any other type always passes.
   */
  admits(message: IncomingMessage): boolean;
}

function throttled(message: IncomingMessage): message is IncomingMessage & {
  readonly type: ThrottledType;
} {
  return message.type === 'cursor' || message.type === 'live_score';
}

/**
 * One allowance per socket.
 *
 * A frame over the limit is **dropped in silence**, not refused. Answering an
 * error per dropped frame would turn a flood of small messages into a flood of
 * replies, which is the amplification the throttle exists to prevent — and the
 * sender loses nothing they can notice, because the next position and the next
 * tally supersede the ones that did not make it.
 *
 * @param now injected rather than read, so the limit is testable without
 * sleeping through it.
 */
export function createThrottle(intervals: Intervals, now: () => number): Throttle {
  const admittedAt: Partial<Record<ThrottledType, number>> = {};

  return {
    admits(message) {
      if (!throttled(message)) return true;

      const at = now();
      const last = admittedAt[message.type];
      if (last !== undefined && at - last < intervals[message.type]) return false;

      admittedAt[message.type] = at;
      return true;
    },
  };
}

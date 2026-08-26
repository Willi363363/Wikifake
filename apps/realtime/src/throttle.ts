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
 * C5.5 — the two floors, from the contract.
 *
 * Re-exported rather than declared: step 8.6 paces the client at the same
 * numbers, and a floor that exists twice is a floor that exists once and a bug
 * that exists once. `cursor` is twenty-five a second, the value the current
 * server ships — a limit loosened during a rewrite is a limit nobody notices
 * has gone. `live_score` is five a second, and D6 is that the current server
 * has no limit on it at all.
 */
export { CURSOR_MIN_INTERVAL_MS, LIVE_SCORE_MIN_INTERVAL_MS } from '@wikifake/protocol';

import {
  CURSOR_MIN_INTERVAL_MS as CURSOR_FLOOR,
  LIVE_SCORE_MIN_INTERVAL_MS as LIVE_SCORE_FLOOR,
} from '@wikifake/protocol';

/** The two message types a socket may send faster than the room can use. */
export type ThrottledType = 'cursor' | 'live_score';

export type Intervals = Readonly<Record<ThrottledType, number>>;

export const DEFAULT_INTERVALS: Intervals = {
  cursor: CURSOR_FLOOR,
  live_score: LIVE_SCORE_FLOOR,
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

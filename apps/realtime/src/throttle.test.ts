// The allowance itself, on a clock the test moves by hand.
//
// `hardening.test.ts` proves a flood is cut on a real socket; this proves what
// "cut" means at the boundary — which needs an exact instant, and an exact
// instant is not something a suite gets by sleeping.
import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from '@wikifake/protocol';

import {
  createThrottle,
  CURSOR_MIN_INTERVAL_MS,
  DEFAULT_INTERVALS,
  LIVE_SCORE_MIN_INTERVAL_MS,
} from './throttle.js';

const CURSOR: IncomingMessage = { type: 'cursor', x: 0.5, y: 0.5 };
const SCORE: IncomingMessage = { type: 'live_score', score: 150 };
const READY: IncomingMessage = { type: 'set_ready', ready: true };

/** A clock the test owns. Starts away from zero, which no interval is. */
function clock(): { now: () => number; advance: (ms: number) => void } {
  let at = 1_000;
  return {
    now: () => at,
    advance: (ms) => {
      at += ms;
    },
  };
}

describe('5.6 — the throttle', () => {
  it('lets the first frame of each type through', () => {
    const throttle = createThrottle(DEFAULT_INTERVALS, clock().now);

    expect(throttle.admits(CURSOR)).toBe(true);
    expect(throttle.admits(SCORE)).toBe(true);
  });

  it('drops what follows within the interval', () => {
    const time = clock();
    const throttle = createThrottle(DEFAULT_INTERVALS, time.now);

    expect(throttle.admits(CURSOR)).toBe(true);
    time.advance(CURSOR_MIN_INTERVAL_MS - 1);
    expect(throttle.admits(CURSOR)).toBe(false);
  });

  it('lets the next one through once the interval has passed', () => {
    const time = clock();
    const throttle = createThrottle(DEFAULT_INTERVALS, time.now);

    expect(throttle.admits(CURSOR)).toBe(true);
    time.advance(CURSOR_MIN_INTERVAL_MS);
    expect(throttle.admits(CURSOR)).toBe(true);
  });

  // A dropped frame must not restart the clock: it would let a fast enough
  // sender hold the allowance open for ever, which is the flood itself.
  it('does not let a refused frame push the next one back', () => {
    const time = clock();
    const throttle = createThrottle(DEFAULT_INTERVALS, time.now);

    throttle.admits(CURSOR);
    for (let sent = 0; sent < 10; sent += 1) {
      time.advance(1);
      expect(throttle.admits(CURSOR)).toBe(false);
    }

    time.advance(CURSOR_MIN_INTERVAL_MS - 10);
    expect(throttle.admits(CURSOR)).toBe(true);
  });

  // The two allowances are separate, so a cursor flood cannot silence a score.
  it('counts each type on its own', () => {
    const time = clock();
    const throttle = createThrottle(DEFAULT_INTERVALS, time.now);

    expect(throttle.admits(CURSOR)).toBe(true);
    expect(throttle.admits(SCORE)).toBe(true);

    time.advance(CURSOR_MIN_INTERVAL_MS);
    expect(throttle.admits(CURSOR)).toBe(true);
    // The cursor's interval has passed; `live_score`'s has not.
    expect(throttle.admits(SCORE)).toBe(false);

    time.advance(LIVE_SCORE_MIN_INTERVAL_MS);
    expect(throttle.admits(SCORE)).toBe(true);
  });

  // Everything else changes the room, and is bounded by what it costs to send.
  it('never holds back a message that does something', () => {
    const throttle = createThrottle(DEFAULT_INTERVALS, clock().now);

    for (let sent = 0; sent < 100; sent += 1) {
      expect(throttle.admits(READY)).toBe(true);
    }
  });

  it('admits one frame per interval and no more', () => {
    const time = clock();
    const throttle = createThrottle({ cursor: 100, live_score: 100 }, time.now);

    let admitted = 0;
    // A second of frames, ten times faster than the limit allows.
    for (let sent = 0; sent < 100; sent += 1) {
      if (throttle.admits(CURSOR)) admitted += 1;
      time.advance(10);
    }

    expect(admitted).toBe(10);
  });
});

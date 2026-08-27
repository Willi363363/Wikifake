'use client';

// C1.4 — paid hints, on the client side of the transaction.
//
// The client holds no solution, so a hint is a thing the server bills and then
// sends. What is kept here is what came back, and the one rule that matters:
// **never go backwards**. A player who has paid for level 2 does not see the
// level-1 nudge again, and does not pay for it again.
//
// C1.3 — the penalty is the server's number. The current hook recomputes it from
// its own copy of the scale (`SCORING` in `frontend/src/config.js`), which is a
// second opinion on what the player owes; `hint_unlocked` carries `hintPenalty`
// and this keeps that.
import type { gameApi } from '@wikifake/protocol';
import { useCallback, useEffect, useMemo, useState } from 'react';

/** What the player holds on one falsification. */
export interface HintHeld {
  readonly level: 1 | 2;
  readonly hint: string;
  /** Level 2 only: the truth, and where it is. */
  readonly truth?: string;
  readonly paragraphIndex?: number;
}

/** What is held, by falsification number. A number absent was never bought. */
export type Hints = Readonly<Record<number, HintHeld>>;

/**
 * What one payload adds.
 *
 * Monotonic, and not because the server is untrusted: the server *is*
 * monotonic — asking for level 1 after buying level 2 returns level 2. This is
 * about arrival order. Two requests in flight can land in either order, and a
 * level-1 answer applied after a level-2 answer would take the truth off the
 * screen and put a "Reveal" button back on it.
 */
export function merged(held: Hints, payload: gameApi.HintResponse): Hints {
  const before = held[payload.falseInfoNumber];
  if (before !== undefined && before.level > payload.grant.level) return held;

  return {
    ...held,
    [payload.falseInfoNumber]:
      payload.grant.level === 2
        ? {
            level: 2,
            hint: payload.hint,
            truth: payload.grant.truth,
            paragraphIndex: payload.grant.paragraphIndex,
          }
        : { level: 1, hint: payload.hint },
  };
}

/**
 * Which paragraphs a hint has pointed at.
 *
 * Level 2 only. A level-1 hint is a sentence, not a location — the current game
 * highlighted the paragraph at level 1 too, which handed over the answer at the
 * nudge's price.
 */
export function pointedAt(held: Hints): ReadonlySet<number> {
  const paragraphs = new Set<number>();
  for (const entry of Object.values(held)) {
    if (entry.paragraphIndex !== undefined) paragraphs.add(entry.paragraphIndex);
  }
  return paragraphs;
}

export interface HintsState {
  readonly held: Hints;
  /** How many falsifications have been bought on. Display only. */
  readonly hintsUsed: number;
  /** C1.3 — the server's running total, not this client's arithmetic. */
  readonly penalty: number;
  readonly hintedParagraphs: ReadonlySet<number>;
  /** C1.5 — a rival's `HINT_LOCK` refused the last request. */
  readonly blocked: boolean;
  apply(payload: gameApi.HintResponse): void;
  block(): void;
  clearBlocked(): void;
}

/**
 * The hints of one round.
 *
 * `roundKey` is the round, and that is the fix: the current hook resets on
 * `totalFakes`, which only ever worked because `GameSession` was unmounted
 * between rounds. Two consecutive rounds with the same number of falsifications
 * — the common case — would have carried the first round's hints into the
 * second.
 */
export function useHints(roundKey: string): HintsState {
  const [held, setHeld] = useState<Hints>({});
  const [penalty, setPenalty] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setHeld({});
    setPenalty(0);
    setBlocked(false);
  }, [roundKey]);

  const apply = useCallback((payload: gameApi.HintResponse) => {
    setHeld((was) => merged(was, payload));
    // Not `+= charged`: the total is a function of what the server has recorded,
    // and a client adding up the charges it happened to see is a client that
    // disagrees the first time one is missed.
    setPenalty(payload.hintPenalty);
    setBlocked(false);
  }, []);

  const block = useCallback(() => {
    setBlocked(true);
  }, []);
  const clearBlocked = useCallback(() => {
    setBlocked(false);
  }, []);

  const hintedParagraphs = useMemo(() => pointedAt(held), [held]);

  return {
    held,
    hintsUsed: Object.keys(held).length,
    penalty,
    hintedParagraphs,
    blocked,
    apply,
    block,
    clearBlocked,
  };
}

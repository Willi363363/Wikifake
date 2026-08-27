// C2 — the scoring scale.
//
// The reference is `C2.1` of plans/rewrite/01-contract-to-preserve.md, not
// `backend/src/scoring.py` and not `frontend/src/config.js`. Those two are the
// duplication this package removes, and nothing guaranteed they still agreed —
// `scale-parity.test.ts` checks that they do, for as long as they exist.
//
// Pure, and the clock is a parameter: `elapsedSeconds` comes in, nothing reads
// `Date.now()`. That is what makes a round-end-by-timeout testable without
// waiting five minutes.
import type { ScoreBreakdown } from '@wikifake/protocol';

/** C2.1 — a paragraph correctly identified as falsified. */
export const PER_TRUE_POSITIVE = 150;
/** C2.1 — a paragraph marked that was not falsified. */
export const PER_FALSE_POSITIVE = 80;
/** C2.1 — points per second left on the clock. */
export const TIME_BONUS_PER_SECOND = 0.5;
/** C2.1 — a level-1 hint. */
export const HINT_COST = 50;
/** C2.1, C2.2 — a level-2 reveal, **in total**: 200, not 50 + 200. */
export const REVEAL_COST = 200;
/** C2.1 — what `SCORE_STEAL` takes from its target. */
export const STEAL_AMOUNT = 50;

/** A hint level, as the protocol allows it: 1 or 2. */
export type HintLevel = 1 | 2;

/**
 * C2.2 — what a level costs, **in total** and not cumulatively.
 *
 * Reaching level 2 costs 200, whether or not level 1 was bought first: a player
 * who pays for the reveal is not charged for the nudge as well. Step 1.5 owns
 * the register of who unlocked what, and bills each number exactly once.
 */
export function hintCostFor(level: HintLevel): number {
  return level >= 2 ? REVEAL_COST : HINT_COST;
}

/**
 * C2.1, C2.3 — points for the time left on the clock, and none past the limit.
 *
 * Truncated, not rounded. `int(time_remaining * 0.5)` is what the current
 * server does, and the difference is not cosmetic: with one second left the
 * bonus is 0, and truncating the *score* instead of the bonus would turn a
 * score of −10 into −9 through a half-point that was never earned.
 */
export function timeBonusFor(timeLimitSeconds: number, elapsedSeconds: number): number {
  const remaining = Math.max(0, timeLimitSeconds - elapsedSeconds);
  return Math.floor(remaining * TIME_BONUS_PER_SECOND);
}

/** One player's round, as the rules need to see it. */
export interface Submission {
  readonly truePositives: number;
  readonly falsePositives: number;
  /** How many numbers the player unlocked a hint on. Display only. */
  readonly hintsUsed: number;
  /** C1.3 — computed from server state, never taken from the client. */
  readonly hintPenalty: number;
  /** C1.5 — what other players stole, applied server-side. */
  readonly scoreStolen: number;
  readonly timeLimitSeconds: number;
  readonly elapsedSeconds: number;
}

/**
 * C2.1 — `score = tp×150 − fp×80 − hintPenalty − scoreStolen + timeBonus`.
 *
 * C2.3 — the result can be negative, and it is not clamped: a player who marks
 * everything and buys every reveal has earned a negative score, and hiding it
 * behind a zero would hide the cost of the items too.
 */
export function scoreFor(submission: Submission): number {
  const { truePositives, falsePositives, hintPenalty, scoreStolen } = submission;
  return (
    truePositives * PER_TRUE_POSITIVE -
    falsePositives * PER_FALSE_POSITIVE -
    hintPenalty -
    scoreStolen +
    timeBonusFor(submission.timeLimitSeconds, submission.elapsedSeconds)
  );
}

/** The score and the breakdown the debrief displays, in the protocol's shape. */
export function gradeSubmission(submission: Submission): {
  readonly score: number;
  readonly breakdown: ScoreBreakdown;
} {
  return {
    score: scoreFor(submission),
    breakdown: {
      truePositives: submission.truePositives,
      falsePositives: submission.falsePositives,
      hintsUsed: submission.hintsUsed,
      hintPenalty: submission.hintPenalty,
      scoreStolen: submission.scoreStolen,
      timeBonus: timeBonusFor(submission.timeLimitSeconds, submission.elapsedSeconds),
    },
  };
}

/**
 * C2.4 — final standings, highest score first.
 *
 * A tie keeps the order it came in. `Array.prototype.sort` is stable, so the
 * caller decides what a tie means — by join order today, which is what the
 * current server's stable Python sort already produced. Returns a new array:
 * the rules do not mutate what they are given.
 */
export function rankByScore<T extends { readonly score: number }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort((a, b) => b.score - a.score);
}

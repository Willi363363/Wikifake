// Days and weeks, as arithmetic — steps F.2, F.4 and G.3.
//
// **Moved here rather than copied.** `periodIndexOf` and `periodWindowOf` were
// written inside `quest-generator.ts` and `quest-progress.ts`, because that is
// where they were first needed. G.3 is the second consumer, and two consumers is
// when shared code gets a neutral home — the same move `button-variants.ts` made
// out of `button.tsx` when a server component needed it, and the same sentence
// applies: this is not a second copy, it is the only copy, moved.
//
// It matters more than tidiness. A board's *day* and a quest's *day* have to be
// the same day, or a player finishing a daily quest at 00:30 UTC and topping the
// daily board are being measured on two clocks. One function decides, and both
// features ask it.
//
// Nothing here reads a clock: `purity.test.ts` refuses `new Date(` in this
// package, so a period is arithmetic on an epoch instant. That is what makes a
// Thursday a number rather than a wait.
import { BOARD_PERIOD_IDS, type BoardPeriodId } from '@wikifake/protocol';

/** The two periods that repeat. Monthly only if it is free — track F. */
export type CalendarPeriod = 'daily' | 'weekly';

/** Half-open: `fromMs` counts, `toMs` is the next period's first instant. */
export interface PeriodWindow {
  readonly fromMs: number;
  readonly toMs: number;
}

export const MS_PER_DAY = 86_400_000;

/**
 * Which day or which week an instant falls in, as an integer.
 *
 * **An index rather than a formatted date**, and the reason is this package's
 * own rule: `new Date(...)` is forbidden here, so producing `2026-09-10` would
 * mean implementing civil-date arithmetic to print a string only a human reads.
 * An integer is what `quest_assignment` needs anyway — `(user, period,
 * periodIndex, ruleId)` unique is what makes running the cron twice write
 * nothing the second time.
 *
 * **Days are UTC days, so a period turns over at midnight UTC** — 01:00 or
 * 02:00 for a French player. Deliberate, and the alternative is worse: a
 * per-player boundary means the quest cron cannot assign everybody at once, and
 * a per-player time zone is a preference E.5 already deferred to
 * `profile.preferences`. When that preference arrives, this is the one function
 * that has to learn about it — and now it is the one function for the boards
 * too.
 *
 * Weeks start on Monday. Epoch day 0 was a Thursday, so `+3` moves the boundary
 * back to the Monday before it — 1969-12-29, which is week 0's first day.
 */
export function periodIndexOf(period: CalendarPeriod, atMs: number): number {
  const day = Math.floor(atMs / MS_PER_DAY);
  return period === 'daily' ? day : Math.floor((day + 3) / 7);
}

/**
 * The instants a period covers — `periodIndexOf` run backwards.
 *
 * Half-open on purpose. A closed window has to name its last instant, and
 * whichever one it names is either a millisecond short or one long: the two
 * periods would share a boundary and a round submitted exactly on it would count
 * twice. `from <= at < to` cannot do that.
 *
 * A week's first day is `index * 7 - 3`, which is `periodIndexOf`'s `+ 3`
 * undone: epoch day 0 was a Thursday, so week 0 began three days before it.
 */
export function periodWindowOf(
  period: CalendarPeriod,
  periodIndex: number,
): PeriodWindow {
  const firstDay = period === 'daily' ? periodIndex : periodIndex * 7 - 3;
  const days = period === 'daily' ? 1 : 7;

  return {
    fromMs: firstDay * MS_PER_DAY,
    toMs: (firstDay + days) * MS_PER_DAY,
  };
}

/**
 * The periods a board is drawn for — step G.3.
 *
 * The track asks for daily, weekly and all-time, and says why the third is not
 * enough on its own: *"an all-time board alone is a wall the first hundred
 * players build against everybody who arrives later."* The first two are the
 * answer to that, and they are the same two a quest uses.
 *
 * **Promoted to `protocol` by G.5**, which put a period in a URL and so made it
 * a contract. This is now the same list rather than a second copy of it: the
 * identifiers are the wire's, and what a period *covers* is still this file's.
 */
export const BOARD_PERIODS = BOARD_PERIOD_IDS;

export type BoardPeriod = BoardPeriodId;

/**
 * The window a board covers, or **null for all of history**.
 *
 * Null rather than a window from zero to the end of time, and the difference is
 * not cosmetic: a query given a window puts a range on `finished_at`, and a
 * query given null puts no clause there at all. An artificial range would be an
 * index scan over every row to prove that every row qualifies — which is exactly
 * the plan G.4 exists to check.
 *
 * `atMs` decides which day or week: the board is the one containing that
 * instant, so a screen passes now and a test passes a Thursday.
 */
export function boardWindowOf(period: BoardPeriod, atMs: number): PeriodWindow | null {
  if (period === 'allTime') return null;
  return periodWindowOf(period, periodIndexOf(period, atMs));
}

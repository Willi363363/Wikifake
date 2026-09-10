// The periods a board is drawn for — step G.3.
//
// The calendar arithmetic itself is already held by F.2's and F.4's suites,
// which is why they were not moved when the functions were: `periodIndexOf` and
// `periodWindowOf` are asserted as an inverse over a year in
// `quest-progress.test.ts`, and the Monday boundary in
// `quest-generator.test.ts`. Re-asserting them here would be two copies of one
// claim.
//
// What is here is what G.3 adds: the third period, the null window that means
// all of history, and **the property the move exists for** — a board's day is a
// quest's day, measured by one function rather than two that agree today.
import { describe, expect, it } from 'vitest';

import {
  boardWindowOf,
  periodIndexOf,
  periodWindowOf,
  BOARD_PERIODS,
  MS_PER_DAY,
  type BoardPeriod,
} from './periods.js';
import { QUEST_CATALOGUE } from './quests.js';

/** 2026-09-10, a Thursday, in the week that began Monday the 7th. */
const THURSDAY = 20_706 * MS_PER_DAY;

describe('G.3 — the three periods', () => {
  it('offers daily, weekly and all-time, and nothing else', () => {
    expect([...BOARD_PERIODS]).toEqual(['daily', 'weekly', 'allTime']);
  });

  it('gives every period an answer', () => {
    for (const period of BOARD_PERIODS) {
      const window = boardWindowOf(period, THURSDAY);
      // Either a window or the deliberate null. Never undefined, which is what
      // a `switch` that lost a case would return.
      expect(window === null || typeof window.fromMs === 'number').toBe(true);
    }
  });

  it('bounds a daily board to the day the instant falls in', () => {
    const window = boardWindowOf('daily', THURSDAY + 13 * 3_600_000);

    expect(window).toEqual({ fromMs: THURSDAY, toMs: THURSDAY + MS_PER_DAY });
  });

  it('bounds a weekly board to the Monday its week began on', () => {
    const window = boardWindowOf('weekly', THURSDAY);

    expect(window).not.toBeNull();
    expect(new Date((window as { fromMs: number }).fromMs).toISOString()).toBe(
      '2026-09-07T00:00:00.000Z',
    );
    expect(
      (window as { toMs: number }).toMs - (window as { fromMs: number }).fromMs,
    ).toBe(7 * MS_PER_DAY);
  });

  it('bounds an all-time board with nothing at all', () => {
    /*
     * Null, and not a window from zero to the end of time.
     *
     * The difference is a `where` clause: a query handed a window puts a range
     * on `finished_at`, and one handed null puts no clause there. An artificial
     * range would be an index scan over every row to prove that every row
     * qualifies — which is the plan G.4 exists to check.
     */
    expect(boardWindowOf('allTime', THURSDAY)).toBeNull();
    // And it does not depend on when it was asked, which a window would.
    expect(boardWindowOf('allTime', 0)).toBeNull();
    expect(boardWindowOf('allTime', THURSDAY + 400 * MS_PER_DAY)).toBeNull();
  });

  it('does not move an all-time board across a boundary', () => {
    // The one case a period-shaped implementation of "all time" would fail: two
    // instants in different days must give the same board.
    expect(boardWindowOf('allTime', THURSDAY)).toEqual(
      boardWindowOf('allTime', THURSDAY + MS_PER_DAY),
    );
  });
});

describe('G.3 — a board’s day is a quest’s day', () => {
  /*
   * The reason `periodIndexOf` and `periodWindowOf` moved out of the quest
   * modules instead of being copied.
   *
   * If the boards had their own calendar, the two would agree on the day this
   * was written and drift the first time either learned about a time zone. A
   * player finishing a daily quest at 00:30 UTC and topping the daily board have
   * to be measured on one clock, and this is the assertion that says so.
   */
  it.each(['daily', 'weekly'] as const)(
    'gives a %s board the window a quest of that period is counted in',
    (period) => {
      for (const offset of [0, 3_600_000, MS_PER_DAY - 1, 5 * MS_PER_DAY]) {
        const at = THURSDAY + offset;
        // What F.4 measures a quest's progress over, for the period containing
        // `at` — the two calls a quest's read path actually makes.
        const questWindow = periodWindowOf(period, periodIndexOf(period, at));

        expect(boardWindowOf(period, at)).toEqual(questWindow);
      }
    },
  );

  it('uses the same two period names the catalogue does', () => {
    // A quest rule's period has to be a board period, or a daily quest and a
    // daily board would be two different words for one day.
    const questPeriods = new Set(
      Object.values(QUEST_CATALOGUE).map((rule) => rule.period),
    );

    for (const period of questPeriods) {
      expect(BOARD_PERIODS as readonly string[]).toContain(period);
    }
  });

  it('adds exactly one period the quests do not have', () => {
    const questPeriods = new Set<string>(
      Object.values(QUEST_CATALOGUE).map((rule) => rule.period),
    );
    const extra = BOARD_PERIODS.filter(
      (period: BoardPeriod) => !questPeriods.has(period),
    );

    expect(extra).toEqual(['allTime']);
  });
});

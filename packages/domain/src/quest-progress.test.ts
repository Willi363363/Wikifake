// Counting progress — step F.4.
//
// Three things get asserted here and each one is a decision F.1 or F.4 wrote
// down rather than an implementation detail: the window's boundaries are
// half-open, `points` is floored per round, and nothing is capped at the target.
//
// The fourth is the one that would be a real defect: a qualifier this file does
// not cover. The union has five members, and a `switch` that lost one would
// return `undefined` and count every round — so every member has a case, and a
// test asserts the list of members it iterates is the whole union.
import { describe, expect, it } from 'vitest';

import { periodIndexOf } from './quest-generator.js';
import {
  isQuestComplete,
  periodWindowOf,
  progressFor,
  qualifies,
  type CountableRound,
} from './quest-progress.js';
import { QUEST_CATALOGUE, type QuestQualifier, type QuestRule } from './quests.js';

/** A finished round, with the good outcome, that every case then varies. */
function round(over: Partial<CountableRound> = {}): CountableRound {
  return {
    truePositives: 3,
    falsePositives: 0,
    totalFakes: 3,
    hintsUsed: 0,
    score: 400,
    mode: 'solo',
    ...over,
  };
}

/** A rule, borrowed from the catalogue and bent to the case's shape. */
function rule(over: Partial<QuestRule>): QuestRule {
  return { ...QUEST_CATALOGUE.DAILY_FINISH_ROUNDS, ...over };
}

const EVERY_QUALIFIER: readonly QuestQualifier[] = [
  'any',
  'perfect',
  'noHints',
  'nothingWronglyMarked',
  'multiplayer',
];

describe('F.4 — which rounds count', () => {
  it('covers every qualifier the catalogue can carry', () => {
    // Guards the list this file iterates. A member added to the union and not
    // here would leave `qualifies` with a `switch` returning undefined, and
    // every assertion below would still pass.
    const used = new Set(Object.values(QUEST_CATALOGUE).map((one) => one.qualifier));
    for (const qualifier of used) {
      expect(EVERY_QUALIFIER).toContain(qualifier);
    }
    expect(EVERY_QUALIFIER).toHaveLength(5);
  });

  it.each(EVERY_QUALIFIER)('answers for %s rather than returning nothing', (which) => {
    expect(typeof qualifies(which, round())).toBe('boolean');
  });

  it('counts any finished round under `any`', () => {
    expect(qualifies('any', round({ truePositives: 0, falsePositives: 9 }))).toBe(true);
  });

  it('asks `isPerfectRound` what perfect means', () => {
    // Both halves of that predicate, because a qualifier that only checked the
    // first would reward marking every paragraph — the one strategy C2.1 exists
    // to punish.
    expect(qualifies('perfect', round())).toBe(true);
    expect(qualifies('perfect', round({ falsePositives: 1 }))).toBe(false);
    expect(qualifies('perfect', round({ truePositives: 2 }))).toBe(false);
    // A round with nothing to find is not a perfect round, which is
    // `isPerfectRound`'s own guard rather than this file's.
    expect(qualifies('perfect', round({ totalFakes: 0, truePositives: 0 }))).toBe(false);
  });

  it('reads a hint as a hint, however cheap', () => {
    expect(qualifies('noHints', round({ hintsUsed: 0 }))).toBe(true);
    expect(qualifies('noHints', round({ hintsUsed: 1 }))).toBe(false);
  });

  it('separates nothing-wrongly-marked from perfect', () => {
    // The two overlap and are not the same: a round that found two of three and
    // marked nothing true qualifies for one and not the other.
    const partial = round({ truePositives: 2, falsePositives: 0 });
    expect(qualifies('nothingWronglyMarked', partial)).toBe(true);
    expect(qualifies('perfect', partial)).toBe(false);
  });

  it('counts a room round and not a solo one under multiplayer', () => {
    expect(qualifies('multiplayer', round({ mode: 'multiplayer' }))).toBe(true);
    expect(qualifies('multiplayer', round({ mode: 'solo' }))).toBe(false);
  });
});

describe('F.4 — what a tally adds up', () => {
  it('counts qualifying rounds and ignores the rest', () => {
    const rounds = [
      round({ mode: 'multiplayer' }),
      round({ mode: 'solo' }),
      round({ mode: 'multiplayer' }),
    ];

    expect(progressFor(rule({ tally: 'rounds', qualifier: 'multiplayer' }), rounds)).toBe(
      2,
    );
    expect(progressFor(rule({ tally: 'rounds', qualifier: 'any' }), rounds)).toBe(3);
  });

  it('sums falsifications found over the rounds that qualify', () => {
    const rounds = [
      round({ truePositives: 3, hintsUsed: 0 }),
      round({ truePositives: 2, hintsUsed: 2 }),
    ];

    expect(
      progressFor(rule({ tally: 'falsificationsFound', qualifier: 'any' }), rounds),
    ).toBe(5);
    // The hinted round's three are not counted, which is the point of pairing a
    // tally with a qualifier rather than having one of each.
    expect(
      progressFor(rule({ tally: 'falsificationsFound', qualifier: 'noHints' }), rounds),
    ).toBe(3);
  });

  it('floors a score at zero per round, and not over the sum', () => {
    /*
     * F.1's decision, and the difference between the two readings is the whole
     * of it. C2.3 lets a round score below zero — mark everything, buy every
     * reveal — and a player whose day is 400 then −150 has *made progress
     * towards a points quest* on any reading a screen can show without looking
     * broken.
     *
     * Flooring the sum would give 250. Flooring per round gives 400: the bad
     * round is worth nothing, and nothing is not negative.
     */
    const rounds = [round({ score: 400 }), round({ score: -150 })];

    expect(progressFor(rule({ tally: 'points', qualifier: 'any' }), rounds)).toBe(400);
  });

  it('never lets progress retreat as rounds are added', () => {
    // The property the floor exists for, over every tally: adding a round can
    // only ever leave progress where it was or move it up.
    const worst = round({ truePositives: 0, falsePositives: 5, score: -300 });

    for (const tally of ['rounds', 'falsificationsFound', 'points'] as const) {
      const before = progressFor(rule({ tally, qualifier: 'any' }), [round()]);
      const after = progressFor(rule({ tally, qualifier: 'any' }), [round(), worst]);
      expect(after).toBeGreaterThanOrEqual(before);
    }
  });

  it('has nothing to add up before anything is played', () => {
    for (const tally of ['rounds', 'falsificationsFound', 'points'] as const) {
      expect(progressFor(rule({ tally, qualifier: 'any' }), [])).toBe(0);
    }
  });

  it('does not cap what a player overshot', () => {
    // Deliberate: a screen wanting "3 / 3" holds the minimum itself, and F.6
    // needs to tell a quest that is just complete from one that was passed
    // while the claim was in flight.
    const rounds = [round(), round(), round(), round(), round()];

    expect(
      progressFor(rule({ tally: 'rounds', target: { min: 3, max: 3 } }), rounds),
    ).toBe(5);
  });

  it('decides completeness in one place', () => {
    expect(isQuestComplete(3, 2)).toBe(false);
    expect(isQuestComplete(3, 3)).toBe(true);
    expect(isQuestComplete(3, 9)).toBe(true);
  });
});

describe('F.4 — the window a period covers', () => {
  const DAY = 86_400_000;

  it('gives a day the day it names', () => {
    const window = periodWindowOf('daily', 20_706);

    expect(window.fromMs).toBe(20_706 * DAY);
    expect(window.toMs).toBe(20_707 * DAY);
    expect(new Date(window.fromMs).toISOString()).toBe('2026-09-10T00:00:00.000Z');
  });

  it('gives a week the Monday it starts on, and seven days of it', () => {
    // 2026-09-10 is a Thursday, in the week that began Monday the 7th.
    const week = periodWindowOf('weekly', 2958);

    expect(new Date(week.fromMs).toISOString()).toBe('2026-09-07T00:00:00.000Z');
    expect(week.toMs - week.fromMs).toBe(7 * DAY);
  });

  it('is the inverse of `periodIndexOf`, over a year of both', () => {
    /*
     * The property that matters, and the one that would break silently: a round
     * submitted at instant `t` must be inside the window of the period
     * `periodIndexOf` puts `t` in. If the two disagreed by a day, progress would
     * be counted against the wrong set — and every other test here would pass,
     * because each checks one of the two functions alone.
     *
     * `periodIndexOf` is imported rather than restated. A local copy of the
     * arithmetic would make this pass for ever while the real pair drifted,
     * which is the trap F.2's mutation run caught in its own suite.
     */
    for (let day = 20_000; day < 20_365; day += 1) {
      // Three instants: the first, the middle and the last millisecond.
      for (const at of [day * DAY, day * DAY + DAY / 2, (day + 1) * DAY - 1]) {
        for (const period of ['daily', 'weekly'] as const) {
          const window = periodWindowOf(period, periodIndexOf(period, at));
          expect(at).toBeGreaterThanOrEqual(window.fromMs);
          expect(at).toBeLessThan(window.toMs);
        }
      }
    }
  });

  it('leaves no instant in two periods, and none in neither', () => {
    // Half-open, asserted: consecutive windows touch exactly.
    for (const period of ['daily', 'weekly'] as const) {
      for (let index = 2950; index < 2970; index += 1) {
        expect(periodWindowOf(period, index).toMs).toBe(
          periodWindowOf(period, index + 1).fromMs,
        );
      }
    }
  });
});

// The quest generator — step F.2.
//
// Its done-when is one sentence — *given a player, a period and a date it
// produces the same set every time* — and a single `toEqual` of two calls does
// not prove it. What would pass that assertion and still be broken is a
// generator that returns the same set for *everybody*, or for every day, or one
// whose draw excludes an endpoint of a rule's range so a target is never the
// number the catalogue says it can be.
//
// So determinism is asserted from both sides: the same inputs agree, and
// different inputs disagree often enough to be doing work. The exit gate F.5
// rests on — "the cron is run twice for the same date and nothing is
// duplicated" — is the first `describe` below, which is the only place that
// property can be proved cheaply.
//
// Dates are built with `Date.UTC`, which the rules may not do and a test may:
// `purity.test.ts` exempts tests precisely so they can supply the clock.
import { describe, expect, it } from 'vitest';

import {
  generateQuestSet,
  periodIndexOf,
  QUESTS_PER_SET,
  type QuestAssignment,
} from './quest-generator.js';
import { questRulesFor, QUEST_CATALOGUE, type QuestPeriod } from './quests.js';

const PERIODS: readonly QuestPeriod[] = ['daily', 'weekly'];

/** A stable list of players, so a failure names the same one every run. */
const PLAYERS = Array.from({ length: 40 }, (_, index) => `player-${String(index)}`);

describe('F.2 — the same inputs give the same set', () => {
  it.each(PERIODS)('%s, called twice', (period) => {
    const first = generateQuestSet('ada', period, 20_340);
    const second = generateQuestSet('ada', period, 20_340);

    expect(second).toEqual(first);
  });

  /*
   * F.5's exit gate, provable here and nowhere cheaper.
   *
   * "The cron is run twice for the same date and nothing is duplicated." What
   * the cron will do is write `(user, period, periodIndex, ruleId, target)`; if
   * a second run produced a different target for the same rule, a unique
   * constraint on the first four columns would either reject the row or update
   * a target a player has already been working towards. Neither is a duplicate,
   * and both are worse than one.
   */
  it('gives every player the identical set on a second run', () => {
    for (const period of PERIODS) {
      for (const player of PLAYERS) {
        expect(generateQuestSet(player, period, 20_341)).toEqual(
          generateQuestSet(player, period, 20_341),
        );
      }
    }
  });

  it('does not depend on the order players are asked in', () => {
    // A generator holding state between calls would pass every assertion above
    // and fail this one.
    const forwards = PLAYERS.map((player) => generateQuestSet(player, 'daily', 20_342));
    const backwards = [...PLAYERS]
      .reverse()
      .map((player) => generateQuestSet(player, 'daily', 20_342));

    expect(backwards).toEqual([...forwards].reverse());
  });
});

describe('F.2 — and different inputs give different sets', () => {
  /** A set as one comparable string, so distinctness is countable. */
  const shapeOf = (set: readonly QuestAssignment[]): string =>
    set.map((quest) => `${quest.ruleId}:${String(quest.target)}`).join(',');

  it.each(PERIODS)('varies over 60 consecutive %s periods', (period) => {
    const shapes = new Set(
      Array.from({ length: 60 }, (_, offset) =>
        shapeOf(generateQuestSet('ada', period, 20_000 + offset)),
      ),
    );

    // Not "all 60 differ": two of sixty colliding is a draw doing its job, not
    // a defect. What this refuses is a generator that ignores the period.
    expect(shapes.size).toBeGreaterThan(30);
  });

  it.each(PERIODS)('varies between players in the same %s period', (period) => {
    const shapes = new Set(
      PLAYERS.map((player) => shapeOf(generateQuestSet(player, period, 20_343))),
    );

    expect(shapes.size).toBeGreaterThan(PLAYERS.length / 2);
  });

  it('does not hand the daily and the weekly seed to the same draw', () => {
    // The period is part of the seed, not only of the rule filter: a generator
    // that seeded on the player and the index alone would give the same shuffle
    // to both sets, which is invisible while the two rule lists differ.
    const daily = generateQuestSet('ada', 'daily', 7);
    const weekly = generateQuestSet('ada', 'weekly', 7);

    expect(daily.map((quest) => quest.ruleId)).not.toEqual(
      weekly.map((quest) => quest.ruleId),
    );
  });

  /*
   * There was a fourth case here and it was worthless, which is worth recording.
   *
   * It claimed to prove the seed's `|` separators were load-bearing — `ada1` in
   * period 2 against `ada` in period 12 — and it passed with the separators
   * removed. It had to: the period is an alphabetic word sitting between an
   * identifier and a run of digits, so the concatenation is unambiguous without
   * them. The three cases above are what actually fail when the seed drops one
   * of its inputs, and a mutation run is how the fourth was found out.
   */
});

describe('F.2 — every set is a well-formed set', () => {
  const everySet = PERIODS.flatMap((period) =>
    PLAYERS.flatMap((player) =>
      Array.from({ length: 20 }, (_, offset) =>
        generateQuestSet(player, period, 20_000 + offset),
      ),
    ),
  );

  it('generated enough sets to be worth checking', () => {
    expect(everySet.length).toBe(2 * PLAYERS.length * 20);
  });

  it('holds as many quests as the period asks for', () => {
    for (const set of everySet) {
      const period = set[0]?.period;
      expect(period).toBeDefined();
      expect(set).toHaveLength(QUESTS_PER_SET[period as QuestPeriod]);
    }
  });

  it('never repeats a rule inside one set', () => {
    for (const set of everySet) {
      expect(new Set(set.map((quest) => quest.ruleId)).size).toBe(set.length);
    }
  });

  it('draws only from the rules of the period it was asked for', () => {
    for (const set of everySet) {
      for (const quest of set) {
        expect(QUEST_CATALOGUE[quest.ruleId].period).toBe(quest.period);
      }
    }
  });

  it('keeps every target inside its own rule’s range', () => {
    for (const set of everySet) {
      for (const quest of set) {
        const rule = QUEST_CATALOGUE[quest.ruleId];
        expect(quest.target).toBeGreaterThanOrEqual(rule.target.min);
        expect(quest.target).toBeLessThanOrEqual(rule.target.max);
        expect(Number.isInteger(quest.target)).toBe(true);
      }
    }
  });

  /** Every distinct target each rule was actually given, over every set above. */
  const drawnPerRule = (): Map<string, Set<number>> => {
    const drawn = new Map<string, Set<number>>();
    for (const set of everySet) {
      for (const quest of set) {
        const seen = drawn.get(quest.ruleId) ?? new Set<number>();
        seen.add(quest.target);
        drawn.set(quest.ruleId, seen);
      }
    }
    return drawn;
  };

  /*
   * Both ends of a narrow range, actually reached.
   *
   * The off-by-one this catches is the ordinary one: `min + floor(draw * (max -
   * min))` never returns `max`, and every assertion above passes on it. A range
   * documented as inclusive whose top value cannot occur is a catalogue lying
   * about itself.
   *
   * **Narrow ranges only, and that limit is the honest one.** The first draft of
   * this test asked it of every rule and failed on `WEEKLY_SCORE_POINTS`, whose
   * range is 2,001 values wide: eight hundred sets cannot be expected to land on
   * one particular number in it. Worse, the bug is *undetectable* there by
   * sampling — losing the top of 2,001 values moves the observed maximum by one.
   * So it is asserted where it can be seen and the wide rules get the assertion
   * below instead, which is what sampling can actually prove about them.
   */
  it('reaches both ends of every range narrow enough to see', () => {
    const drawn = drawnPerRule();
    let checked = 0;

    for (const [ruleId, seen] of drawn) {
      const rule = QUEST_CATALOGUE[ruleId as keyof typeof QUEST_CATALOGUE];
      if (rule.target.max - rule.target.min > 4) continue;
      checked += 1;

      expect(seen.has(rule.target.min), `${ruleId} never drew its minimum`).toBe(true);
      expect(seen.has(rule.target.max), `${ruleId} never drew its maximum`).toBe(true);
    }

    // A test that silently checked nothing would pass for ever.
    expect(checked).toBeGreaterThan(3);
  });

  /*
   * A wide range, covered rather than sat on.
   *
   * The threshold is relative to the range and not a flat number, which the
   * first draft got wrong: it asked for more than twenty distinct targets from
   * `DAILY_FIND_FALSIFICATIONS`, whose range holds **seven values in total**. A
   * bound larger than the range is a test no correct implementation can pass.
   *
   * So a range narrow enough to enumerate must be covered *entirely* — every one
   * of its seven values, over three hundred draws — and a range too wide for
   * that must show at least twenty. A draw stuck on its seed, or a target
   * computed from the rule instead of from the sequence, gives one value for
   * everybody and fails either way.
   */
  it('covers a wide range instead of settling inside it', () => {
    const drawn = drawnPerRule();

    for (const [ruleId, seen] of drawn) {
      const rule = QUEST_CATALOGUE[ruleId as keyof typeof QUEST_CATALOGUE];
      const span = rule.target.max - rule.target.min + 1;
      if (span <= 5) continue;

      expect(seen.size, `${ruleId} drew too few of its ${String(span)}`).toBeGreaterThan(
        Math.min(span - 1, 20),
      );
    }
  });

  it('leaves no rule undrawable', () => {
    // A shuffle that never moved the last element, or a slice off by one, would
    // quietly retire a rule. Over 800 sets every rule of a period must appear.
    const appeared = new Set(everySet.flatMap((set) => set.map((quest) => quest.ruleId)));

    for (const period of PERIODS) {
      for (const rule of questRulesFor(period)) {
        expect(appeared.has(rule.id), `${rule.id} was never drawn`).toBe(true);
      }
    }
  });
});

describe('F.2 — which day, and which week', () => {
  const at = (year: number, month: number, day: number, hour = 0, minute = 0): number =>
    Date.UTC(year, month - 1, day, hour, minute);

  it('counts UTC days from the epoch', () => {
    expect(periodIndexOf('daily', at(1970, 1, 1))).toBe(0);
    expect(periodIndexOf('daily', at(1970, 1, 2))).toBe(1);
    expect(periodIndexOf('daily', at(2026, 9, 10))).toBe(20_706);
  });

  it('turns a daily set over at midnight UTC and not before', () => {
    // The decision, held: 23:59 is still today, 00:00 is tomorrow. A French
    // player's day therefore turns at 02:00 their time in summer, which is
    // documented rather than accidental.
    expect(periodIndexOf('daily', at(2026, 9, 10, 23, 59))).toBe(
      periodIndexOf('daily', at(2026, 9, 10)),
    );
    expect(periodIndexOf('daily', at(2026, 9, 11, 0, 0))).toBe(
      periodIndexOf('daily', at(2026, 9, 10)) + 1,
    );
  });

  it('advances one day per 24 hours, across a month and a year end', () => {
    for (const [from, to] of [
      [at(2026, 1, 31), at(2026, 2, 1)],
      [at(2026, 2, 28), at(2026, 3, 1)],
      [at(2026, 12, 31), at(2027, 1, 1)],
      // A leap year, which is the one an arithmetic day index gets right for
      // free and a hand-rolled calendar gets wrong.
      [at(2028, 2, 28), at(2028, 2, 29)],
      [at(2028, 2, 29), at(2028, 3, 1)],
    ] as const) {
      expect(periodIndexOf('daily', to)).toBe(periodIndexOf('daily', from) + 1);
    }
  });

  it('starts a week on Monday', () => {
    // 2026-09-10 is a Thursday. Its week must be the one that began on the 7th
    // and must not be the one that begins on the 14th.
    const thursday = periodIndexOf('weekly', at(2026, 9, 10));
    expect(periodIndexOf('weekly', at(2026, 9, 7))).toBe(thursday);
    expect(periodIndexOf('weekly', at(2026, 9, 13))).toBe(thursday);
    expect(periodIndexOf('weekly', at(2026, 9, 14))).toBe(thursday + 1);
    expect(periodIndexOf('weekly', at(2026, 9, 6))).toBe(thursday - 1);
  });

  it('holds one week to seven days, over a year of them', () => {
    const first = at(2026, 1, 5); // a Monday
    for (let week = 0; week < 52; week += 1) {
      const monday = first + week * 7 * 86_400_000;
      const sunday = monday + 6 * 86_400_000;
      expect(periodIndexOf('weekly', sunday)).toBe(periodIndexOf('weekly', monday));
      expect(periodIndexOf('weekly', monday + 7 * 86_400_000)).toBe(
        periodIndexOf('weekly', monday) + 1,
      );
    }
  });

  it('gives a player created at 03:00 the same set as the rest of that day', () => {
    // The track's exit gate: a player created at 03:00 sees quests immediately.
    // What makes that free is that the set is a function of the day, so the read
    // path can generate it without knowing whether the cron ever ran.
    const morning = periodIndexOf('daily', at(2026, 9, 10, 3, 0));
    const evening = periodIndexOf('daily', at(2026, 9, 10, 21, 30));

    expect(morning).toBe(evening);
    expect(generateQuestSet('newcomer', 'daily', morning)).toEqual(
      generateQuestSet('newcomer', 'daily', evening),
    );
  });
});

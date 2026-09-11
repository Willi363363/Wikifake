// The quest catalogue — step F.1.
//
// A file of pure data gets the tests a file of pure data can fail: the ones that
// catch a hand edit. Every entry below has been mistyped in a catalogue
// somewhere — a key whose definition names a different identifier, a range whose
// bounds are the wrong way round, a member of a union nothing uses.
//
// What is deliberately *not* here is whether the numbers are good quests. Twelve
// falsifications a day is a judgement, it is written down in the file itself as
// a judgement, and a test asserting `12` would only make the judgement harder to
// change. What is asserted is that the shape cannot lie.
import { describe, expect, it } from 'vitest';

import {
  questRulesFor,
  QUEST_CATALOGUE,
  QUEST_RULES,
  QUEST_RULE_IDS,
  type QuestQualifier,
  type QuestRule,
  type QuestTally,
} from './quests.js';

describe('F.1 — the catalogue is complete and consistent', () => {
  it('has one definition per identifier, and no others', () => {
    expect(Object.keys(QUEST_CATALOGUE).sort()).toEqual([...QUEST_RULE_IDS].sort());
    expect(QUEST_RULES).toHaveLength(QUEST_RULE_IDS.length);
  });

  // The mistake copy-and-paste makes, and the one a type cannot catch: a
  // `Record` keyed by an identifier does not check that the definition inside
  // names the same one, so `DAILY_SCORE_POINTS: { id: 'DAILY_FINISH_ROUNDS' }`
  // compiles. Everything downstream keys on `rule.id`, so it would resolve to
  // the wrong copy, the wrong label and the wrong reward.
  it.each([...QUEST_RULE_IDS])('%s names itself', (id) => {
    expect(QUEST_CATALOGUE[id].id).toBe(id);
  });

  it('lists the rules in the order the identifiers do', () => {
    expect(QUEST_RULES.map((rule) => rule.id)).toEqual([...QUEST_RULE_IDS]);
  });

  it('spells its period into its own identifier', () => {
    // The naming decision, held rather than trusted: `WEEKLY_` on a rule with
    // `period: 'daily'` is a rule a screen would file under the wrong heading
    // while the generator drew it for the other one.
    for (const rule of QUEST_RULES) {
      expect(rule.id.startsWith(rule.period === 'daily' ? 'DAILY_' : 'WEEKLY_')).toBe(
        true,
      );
    }
  });
});

describe('F.1 — every target is a range something can be drawn from', () => {
  it.each(QUEST_RULES)('$id', (rule: QuestRule) => {
    // Inclusive at both ends, so equal bounds are a fixed target rather than an
    // empty range — allowed, if a rule ever wants one.
    expect(rule.target.min).toBeLessThanOrEqual(rule.target.max);
    // A target of zero is a quest that is complete before it is assigned, and a
    // fractional one is a target no counted column can ever equal.
    expect(rule.target.min).toBeGreaterThan(0);
    expect(Number.isInteger(rule.target.min)).toBe(true);
    expect(Number.isInteger(rule.target.max)).toBe(true);
  });

  it.each(QUEST_RULES)('$id pays something, in whole coins', (rule: QuestRule) => {
    expect(rule.reward).toBeGreaterThan(0);
    expect(Number.isInteger(rule.reward)).toBe(true);
  });
});

describe('F.1 — the two sets, and nothing outside them', () => {
  it('draws a daily set from the daily rules alone', () => {
    const daily = questRulesFor('daily');
    expect(daily.length).toBeGreaterThan(2);
    expect(daily.every((rule) => rule.period === 'daily')).toBe(true);
  });

  it('draws a weekly set from the weekly rules alone', () => {
    const weekly = questRulesFor('weekly');
    expect(weekly.length).toBeGreaterThan(2);
    expect(weekly.every((rule) => rule.period === 'weekly')).toBe(true);
  });

  it('leaves no rule out of both sets', () => {
    expect(questRulesFor('daily').length + questRulesFor('weekly').length).toBe(
      QUEST_RULES.length,
    );
  });

  /*
   * A weekly quest that asks for no more than a daily one is a weekly quest
   * nobody notices they have finished.
   *
   * Compared per tally, because comparing rounds against points would be
   * comparing units. It is the one calibration worth holding mechanically: the
   * numbers themselves are a judgement, but *weekly above daily* is the shape
   * that judgement has to keep.
   */
  it.each(['rounds', 'falsificationsFound', 'points'] as const)(
    'asks more of a week than of a day, in %s',
    (tally: QuestTally) => {
      const lowest = (period: 'daily' | 'weekly'): number =>
        Math.min(
          ...questRulesFor(period)
            .filter((rule) => rule.tally === tally)
            .map((rule) => rule.target.min),
        );

      // `any` qualifier or not, the cheapest week must beat the cheapest day.
      expect(lowest('weekly')).toBeGreaterThan(lowest('daily'));
    },
  );
});

describe('F.1 — no member of a union that nothing counts', () => {
  /*
   * A dead qualifier is not harmless: it is a `case` F.4 has to write, a branch
   * a test has to cover, and a promise on the quests screen that no rule keeps.
   * `solo` was in this union until this test was written, counted by nothing.
   *
   * The lists are spelled out rather than derived from the types — a type cannot
   * be enumerated at runtime, and deriving them from the catalogue would make
   * the assertion `x === x`.
   */
  it.each(['any', 'perfect', 'noHints', 'nothingWronglyMarked', 'multiplayer'] as const)(
    'has a rule that qualifies on %s',
    (qualifier: QuestQualifier) => {
      expect(QUEST_RULES.some((rule) => rule.qualifier === qualifier)).toBe(true);
    },
  );

  it.each(['rounds', 'falsificationsFound', 'points'] as const)(
    'has a rule that tallies %s',
    (tally: QuestTally) => {
      expect(QUEST_RULES.some((rule) => rule.tally === tally)).toBe(true);
    },
  );

  // The other direction: a rule using a name the unions do not carry would be a
  // rule F.4 falls through the switch on. The types stop it at compile time in
  // this package; this catches a value arriving as data from anywhere else.
  it('uses no qualifier or tally outside the two unions', () => {
    const qualifiers = new Set([
      'any',
      'perfect',
      'noHints',
      'nothingWronglyMarked',
      'multiplayer',
    ]);
    const tallies = new Set(['rounds', 'falsificationsFound', 'points']);

    for (const rule of QUEST_RULES) {
      expect(qualifiers.has(rule.qualifier)).toBe(true);
      expect(tallies.has(rule.tally)).toBe(true);
    }
  });
});

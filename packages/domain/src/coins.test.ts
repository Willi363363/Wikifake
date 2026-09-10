// What a round is worth — step H.3.
//
// A file of arithmetic gets the tests arithmetic can fail: the two constants,
// their sum, and the one decision worth holding — **coins are not proportional
// to score**.
import { describe, expect, it } from 'vitest';

import { coinsForRound, COINS_PER_PERFECT_ROUND, COINS_PER_ROUND } from './coins.js';
import { QUEST_RULES } from './quests.js';

describe('H.3 — what a round pays', () => {
  it('pays every finished round', () => {
    expect(coinsForRound({ perfect: false })).toBe(COINS_PER_ROUND);
  });

  it('adds a bonus for a perfect one', () => {
    expect(coinsForRound({ perfect: true })).toBe(
      COINS_PER_ROUND + COINS_PER_PERFECT_ROUND,
    );
  });

  it('pays something for a round that was not perfect', () => {
    // A player who finishes badly still earns: the trickle exists so that
    // somebody who never opens the quest screen is not earning nothing.
    expect(coinsForRound({ perfect: false })).toBeGreaterThan(0);
  });

  it('takes what the grading decided rather than a round', () => {
    /*
     * The signature is the assertion: it accepts `{ perfect }` and nothing
     * else, so it cannot disagree with E.4's streak or F.1's `perfect`
     * qualifier about the round they are all describing. A version taking
     * `truePositives` and `totalFakes` would be a second implementation of
     * `isPerfectRound`.
     */
    expect(coinsForRound({ perfect: true })).not.toBe(coinsForRound({ perfect: false }));
  });

  it('stays well under what a quest pays', () => {
    /*
     * The calibration, held mechanically. Coins are meant to accumulate from
     * the retention loop, and a per-round trickle that rivalled a quest's
     * reward would make the quests stop mattering — which is the whole reason
     * track F exists.
     *
     * The cheapest quest in the catalogue is the bar: a perfect round must be
     * worth clearly less than it.
     */
    const cheapestQuest = Math.min(...QUEST_RULES.map((rule) => rule.reward));

    expect(coinsForRound({ perfect: true })).toBeLessThan(cheapestQuest / 2);
  });

  it('is whole coins', () => {
    // The ledger's `amount` is an integer, so a fractional reward would be
    // rounded by Postgres rather than by anybody's decision.
    for (const perfect of [true, false]) {
      expect(Number.isInteger(coinsForRound({ perfect }))).toBe(true);
    }
  });
});

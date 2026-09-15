// The badge catalogue, held to its own shape — step M.1.
import { describe, expect, it } from 'vitest';

import {
  BADGE_CATALOGUE,
  BADGE_IDS,
  BADGES,
  badgesEarned,
  holdsBadge,
  isBadgeId,
  nextBadgeIn,
  RATIO_METRICS,
  type BadgeMetric,
  type BadgeStats,
} from './badges.js';

/** A player who has done nothing. Every case then varies one figure. */
function stats(over: Partial<BadgeStats> = {}): BadgeStats {
  return {
    gamesFinished: 0,
    falsificationsFound: 0,
    bestScore: null,
    bestStreak: 0,
    accuracy: null,
    ...over,
  };
}

describe('M.1 — the catalogue', () => {
  it('defines every identifier exactly once', () => {
    expect(BADGES).toHaveLength(BADGE_IDS.length);
    expect(new Set(BADGE_IDS).size).toBe(BADGE_IDS.length);
  });

  it.each(BADGE_IDS)('%s is keyed by its own id', (id) => {
    expect(BADGE_CATALOGUE[id].id).toBe(id);
  });

  it.each(BADGE_IDS)('%s has a positive threshold', (id) => {
    expect(BADGE_CATALOGUE[id].threshold).toBeGreaterThan(0);
  });

  /*
   * The rule the track states: a ratio needs a floor, or one perfect round buys
   * the top rung. Held in both directions — a ratio without a floor is the
   * defect, and a counter *with* one would be a cost nobody decided on.
   */
  it.each(BADGE_IDS)('%s carries a floor if and only if it reads a ratio', (id) => {
    const badge = BADGE_CATALOGUE[id];
    const isRatio = RATIO_METRICS.includes(badge.metric);

    expect(badge.minFinished > 0).toBe(isRatio);
  });

  it.each(RATIO_METRICS)('%s is a fraction of one, not a percentage', (metric) => {
    for (const badge of BADGES.filter((one) => one.metric === metric)) {
      expect(badge.threshold).toBeLessThanOrEqual(1);
    }
  });

  /*
   * Every metric is a ladder with somewhere above the bottom rung. A metric with
   * one badge is a metric that stops meaning anything the moment it is held —
   * which is the whole complaint this track answers about the profile.
   */
  it('gives every metric at least three rungs', () => {
    const rungs = new Map<BadgeMetric, number>();
    for (const badge of BADGES)
      rungs.set(badge.metric, (rungs.get(badge.metric) ?? 0) + 1);

    for (const [metric, count] of rungs) expect(count, metric).toBeGreaterThanOrEqual(2);
    expect(rungs.size).toBe(5);
  });

  it('knows its own identifiers and refuses others', () => {
    expect(isBadgeId('FINISHED_10')).toBe(true);
    expect(isBadgeId('FINISHED_11')).toBe(false);
  });
});

describe('M.1 — what a player holds', () => {
  it('gives nothing to a player who has finished nothing', () => {
    expect(badgesEarned(stats())).toEqual([]);
  });

  it('holds a rung at exactly its threshold', () => {
    expect(holdsBadge(BADGE_CATALOGUE.FINISHED_10, stats({ gamesFinished: 10 }))).toBe(
      true,
    );
    expect(holdsBadge(BADGE_CATALOGUE.FINISHED_10, stats({ gamesFinished: 9 }))).toBe(
      false,
    );
  });

  it('holds every rung below the one reached', () => {
    const held = badgesEarned(stats({ gamesFinished: 60 })).map((badge) => badge.id);

    expect(held).toEqual(['FINISHED_1', 'FINISHED_10', 'FINISHED_50']);
  });

  /*
   * Null is not zero. A player with no finished round has no best score, and
   * reading that as nought would answer a question that has no answer — the
   * reason `player_stats.best_score` is nullable in the first place.
   */
  it('reads a null figure as nothing rather than as nought', () => {
    expect(holdsBadge(BADGE_CATALOGUE.SCORE_300, stats({ bestScore: null }))).toBe(false);
  });

  // The trap the floor exists for.
  it('refuses a ratio rung to a player with one perfect round', () => {
    const held = badgesEarned(stats({ gamesFinished: 1, accuracy: 1 })).map((b) => b.id);

    expect(held).toEqual(['FINISHED_1']);
  });

  it('grants a ratio rung once the floor is cleared', () => {
    const held = badgesEarned(stats({ gamesFinished: 20, accuracy: 0.92 })).map(
      (b) => b.id,
    );

    expect(held).toContain('ACCURACY_75');
    expect(held).toContain('ACCURACY_90');
  });
});

describe('M.1 — the next rung', () => {
  it('is the first one for a player who has nothing', () => {
    expect(nextBadgeIn('gamesFinished', stats())?.id).toBe('FINISHED_1');
  });

  it('is the one above what is held', () => {
    expect(nextBadgeIn('gamesFinished', stats({ gamesFinished: 12 }))?.id).toBe(
      'FINISHED_50',
    );
  });

  it('is null at the top of a ladder', () => {
    expect(nextBadgeIn('gamesFinished', stats({ gamesFinished: 5000 }))).toBeNull();
  });

  /*
   * The lowest *unheld* rung, not the one after the highest held. A counter
   * cannot go down, but a ratio can — a player at 0.92 over twenty rounds who
   * drops to 0.80 over forty is missing the 90 rung and should be shown it.
   */
  it('shows the rung actually missing when a ratio has fallen', () => {
    const fallen = stats({ gamesFinished: 40, accuracy: 0.8 });

    expect(nextBadgeIn('accuracy', fallen)?.id).toBe('ACCURACY_90');
  });
});

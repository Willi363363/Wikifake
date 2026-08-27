import { describe, expect, it } from 'vitest';

import {
  gradeSubmission,
  hintCostFor,
  HINT_COST,
  PER_FALSE_POSITIVE,
  PER_TRUE_POSITIVE,
  rankByScore,
  REVEAL_COST,
  scoreFor,
  STEAL_AMOUNT,
  timeBonusFor,
  TIME_BONUS_PER_SECOND,
  type Submission,
} from './scoring.js';

const NOTHING: Submission = {
  truePositives: 0,
  falsePositives: 0,
  hintsUsed: 0,
  hintPenalty: 0,
  scoreStolen: 0,
  timeLimitSeconds: 300,
  elapsedSeconds: 300,
};

describe('C2.5 — the reference case', () => {
  // tp=3, fp=1, penalty=20, stolen=50, 200 s left of 300 -> 400.
  // 3x150 = 450, -1x80 = 370, -20 = 350, -50 = 300, +100 = 400.
  //
  // This case is the contract. If it ever fails, the scale changed, and that is
  // a decision to be made in a pull request rather than discovered in a debrief.
  it('scores 400', () => {
    expect(
      scoreFor({
        truePositives: 3,
        falsePositives: 1,
        hintsUsed: 1,
        hintPenalty: 20,
        scoreStolen: 50,
        timeLimitSeconds: 300,
        elapsedSeconds: 100,
      }),
    ).toBe(400);
  });
});

describe('C2.1 — the scale', () => {
  it('pays 150 a true positive', () => {
    expect(scoreFor({ ...NOTHING, truePositives: 1 })).toBe(PER_TRUE_POSITIVE);
    expect(scoreFor({ ...NOTHING, truePositives: 4 })).toBe(4 * PER_TRUE_POSITIVE);
  });

  it('charges 80 a false positive', () => {
    expect(scoreFor({ ...NOTHING, falsePositives: 1 })).toBe(-PER_FALSE_POSITIVE);
  });

  it('subtracts the hint penalty and what was stolen', () => {
    expect(
      scoreFor({ ...NOTHING, truePositives: 2, hintPenalty: 50, scoreStolen: 50 }),
    ).toBe(200);
  });

  it('keeps the constants the contract names', () => {
    expect([PER_TRUE_POSITIVE, PER_FALSE_POSITIVE, TIME_BONUS_PER_SECOND]).toEqual([
      150, 80, 0.5,
    ]);
    expect([HINT_COST, REVEAL_COST, STEAL_AMOUNT]).toEqual([50, 200, 50]);
  });
});

describe('C2.2 — a hint level costs its total, not the sum', () => {
  it('charges 200 for a reveal, not 250', () => {
    expect(hintCostFor(2)).toBe(200);
    expect(hintCostFor(2)).not.toBe(HINT_COST + REVEAL_COST);
  });

  it('charges 50 for a nudge', () => {
    expect(hintCostFor(1)).toBe(50);
  });
});

describe('C2.1, C2.3 — the time bonus', () => {
  it('pays half a point a second left', () => {
    expect(timeBonusFor(300, 100)).toBe(100);
    expect(timeBonusFor(300, 0)).toBe(150);
  });

  it('pays nothing once the limit is reached', () => {
    expect(timeBonusFor(300, 300)).toBe(0);
  });

  // No negative bonus: running over does not cost points, it stops earning
  // them.
  it('pays nothing past the limit, however far past', () => {
    expect(timeBonusFor(300, 301)).toBe(0);
    expect(timeBonusFor(300, 100_000)).toBe(0);
  });

  // Truncated, like `int(remaining * 0.5)`. One second left is worth nothing.
  it('truncates rather than rounds', () => {
    expect(timeBonusFor(300, 299)).toBe(0);
    expect(timeBonusFor(300, 297)).toBe(1);
  });

  // Truncating the score instead of the bonus would turn -10 into -9 through a
  // half point nobody earned.
  it('truncates the bonus, not the score', () => {
    expect(scoreFor({ ...NOTHING, falsePositives: 1, elapsedSeconds: 299 })).toBe(-80);
  });
});

describe('C2.3 — a score can be negative', () => {
  it('does not clamp at zero', () => {
    expect(
      scoreFor({
        ...NOTHING,
        falsePositives: 5,
        hintPenalty: REVEAL_COST,
        scoreStolen: 50,
      }),
    ).toBe(-650);
  });

  // A player who marks everything and buys every reveal has earned that score.
  // Hiding it behind a zero would hide what the items cost them.
  it('reports the loss rather than hiding it', () => {
    expect(scoreFor({ ...NOTHING, truePositives: 1, falsePositives: 3 })).toBe(-90);
  });
});

describe('the breakdown', () => {
  it('reports every component in the protocol shape', () => {
    const graded = gradeSubmission({
      truePositives: 3,
      falsePositives: 1,
      hintsUsed: 1,
      hintPenalty: 20,
      scoreStolen: 50,
      timeLimitSeconds: 300,
      elapsedSeconds: 100,
    });

    expect(graded).toEqual({
      score: 400,
      breakdown: {
        truePositives: 3,
        falsePositives: 1,
        hintsUsed: 1,
        hintPenalty: 20,
        scoreStolen: 50,
        timeBonus: 100,
      },
    });
  });

  it('reports the same bonus the score used', () => {
    const graded = gradeSubmission({ ...NOTHING, truePositives: 1, elapsedSeconds: 297 });
    expect(graded.breakdown.timeBonus).toBe(1);
    expect(graded.score).toBe(151);
  });
});

describe('C2.4 — the leaderboard', () => {
  it('sorts by descending score', () => {
    const ranked = rankByScore([
      { player: 'ada', score: 120 },
      { player: 'bob', score: 400 },
      { player: 'cyd', score: -50 },
    ]);
    expect(ranked.map((entry) => entry.player)).toEqual(['bob', 'ada', 'cyd']);
  });

  it('keeps a tie in the order it came in', () => {
    const ranked = rankByScore([
      { player: 'ada', score: 100 },
      { player: 'bob', score: 100 },
      { player: 'cyd', score: 100 },
    ]);
    expect(ranked.map((entry) => entry.player)).toEqual(['ada', 'bob', 'cyd']);
  });

  // The rules decide, they do not mutate: a reducer returning a sorted copy of
  // its input is not the same as one that reordered the room's roster.
  it('does not touch what it was given', () => {
    const entries = [{ score: 1 }, { score: 2 }];
    rankByScore(entries);
    expect(entries.map((entry) => entry.score)).toEqual([1, 2]);
  });

  it('handles the empty and single cases', () => {
    expect(rankByScore([])).toEqual([]);
    expect(rankByScore([{ score: 7 }])).toEqual([{ score: 7 }]);
  });
});

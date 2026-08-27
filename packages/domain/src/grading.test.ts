import { describe, expect, it } from 'vitest';
import type { FalsifiedPosition } from '@wikifake/protocol';

import { gradeAnswer, isWellFormedSolution, solutionIssues } from './grading.js';
import { gradeSubmission } from './scoring.js';

/** Three falsifications, at paragraphs 2, 5 and 9. Well formed per C3.3. */
const SOLUTION: FalsifiedPosition[] = [
  {
    paragraphIndex: 2,
    falseInfoNumber: 1,
    falseStatement: 'faux 1',
    explanation: 'vrai 1',
    hint: 'indice 1',
  },
  {
    paragraphIndex: 5,
    falseInfoNumber: 2,
    falseStatement: 'faux 2',
    explanation: 'vrai 2',
    hint: 'indice 2',
  },
  {
    paragraphIndex: 9,
    falseInfoNumber: 3,
    falseStatement: 'faux 3',
    explanation: 'vrai 3',
    hint: 'indice 3',
  },
];

function position(overrides: Partial<FalsifiedPosition>): FalsifiedPosition {
  return { ...SOLUTION[0]!, ...overrides };
}

describe('a complete answer', () => {
  it('finds everything and misses nothing', () => {
    expect(gradeAnswer(SOLUTION, [2, 5, 9])).toEqual({
      found: [2, 5, 9],
      wrong: [],
      missed: [],
    });
  });

  it('does not care what order the marks arrive in', () => {
    expect(gradeAnswer(SOLUTION, [9, 2, 5])).toEqual({
      found: [2, 5, 9],
      wrong: [],
      missed: [],
    });
  });
});

describe('a partial answer', () => {
  it('reports what was found and what was missed', () => {
    expect(gradeAnswer(SOLUTION, [2])).toEqual({ found: [2], wrong: [], missed: [5, 9] });
  });
});

describe('an empty answer', () => {
  it('finds nothing and misses everything', () => {
    expect(gradeAnswer(SOLUTION, [])).toEqual({
      found: [],
      wrong: [],
      missed: [2, 5, 9],
    });
  });

  // A player who submits nothing scores nothing, not a negative: there is no
  // false positive to charge for.
  it('scores zero, not a penalty', () => {
    const { found, wrong } = gradeAnswer(SOLUTION, []);
    const { score } = gradeSubmission({
      truePositives: found.length,
      falsePositives: wrong.length,
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: 0,
      timeLimitSeconds: 300,
      elapsedSeconds: 300,
    });
    expect(score).toBe(0);
  });
});

describe('an over-marked answer', () => {
  it('charges every paragraph that was not falsified', () => {
    expect(gradeAnswer(SOLUTION, [1, 2, 3, 4, 5])).toEqual({
      found: [2, 5],
      wrong: [1, 3, 4],
      missed: [9],
    });
  });

  it('marking everything is worse than marking nothing', () => {
    const all = Array.from({ length: 12 }, (_value, at) => at + 1);
    const grading = gradeAnswer(SOLUTION, all);
    expect(grading.found).toEqual([2, 5, 9]);
    expect(grading.wrong).toHaveLength(9);

    const { score } = gradeSubmission({
      truePositives: grading.found.length,
      falsePositives: grading.wrong.length,
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: 0,
      timeLimitSeconds: 300,
      elapsedSeconds: 300,
    });
    // 3x150 - 9x80 = 450 - 720
    expect(score).toBe(-270);
  });
});

describe('duplicates count once', () => {
  // `check_answer` counts a duplicate as many times as it appears: marking the
  // same paragraph three times scores it three times — 450 points for one
  // paragraph. Nothing in the protocol forbids the repeat.
  it('scores a paragraph marked three times exactly once', () => {
    expect(gradeAnswer(SOLUTION, [2, 2, 2])).toEqual({
      found: [2],
      wrong: [],
      missed: [5, 9],
    });
  });

  it('charges a wrong paragraph marked three times exactly once', () => {
    expect(gradeAnswer(SOLUTION, [1, 1, 1])).toEqual({
      found: [],
      wrong: [1],
      missed: [2, 5, 9],
    });
  });

  it('leaves the score where a single mark would put it', () => {
    const once = gradeAnswer(SOLUTION, [2]);
    const thrice = gradeAnswer(SOLUTION, [2, 2, 2]);
    expect(thrice).toEqual(once);
  });
});

describe('an index that matches no paragraph', () => {
  // It cannot be a falsification, so it costs what marking a clean paragraph
  // costs. Refusing the whole submission would lose an honest player their
  // round over a client-side bug.
  it('is wrong rather than fatal', () => {
    expect(gradeAnswer(SOLUTION, [2, 9_999])).toEqual({
      found: [2],
      wrong: [9_999],
      missed: [5, 9],
    });
  });
});

describe('C3.3 — a well-formed solution', () => {
  it('accepts the reference solution', () => {
    expect(solutionIssues(SOLUTION)).toEqual([]);
    expect(isWellFormedSolution(SOLUTION)).toBe(true);
  });

  it('accepts a single falsification', () => {
    expect(isWellFormedSolution([SOLUTION[0]!])).toBe(true);
  });

  it('refuses an empty solution: a round always had at least one fake', () => {
    expect(solutionIssues([])).toEqual(['a round has at least one falsification']);
  });
});

describe('C3.3 — indices are 1-based', () => {
  it.each([[0], [-1], [1.5]])('refuses paragraphIndex %s', (paragraphIndex) => {
    const issues = solutionIssues([position({ paragraphIndex })]);
    expect(issues.some((issue) => issue.includes('1-based'))).toBe(true);
  });
});

describe('C3.3 — positions are sorted by ascending index', () => {
  it('refuses a solution in the wrong order', () => {
    const issues = solutionIssues([
      position({ paragraphIndex: 9, falseInfoNumber: 1 }),
      position({ paragraphIndex: 2, falseInfoNumber: 2 }),
    ]);
    expect(issues).toContain('positions are not sorted by ascending paragraph index');
  });

  it('refuses two falsifications on the same paragraph', () => {
    const issues = solutionIssues([
      position({ paragraphIndex: 2, falseInfoNumber: 1 }),
      position({ paragraphIndex: 2, falseInfoNumber: 2 }),
    ]);
    expect(issues).toContain('two falsifications point at the same paragraph');
  });
});

describe('C3.3 — falseInfoNumber is sequential from 1 to n', () => {
  it('refuses numbering that starts at 0', () => {
    const issues = solutionIssues([position({ paragraphIndex: 2, falseInfoNumber: 0 })]);
    expect(issues.some((issue) => issue.includes('sequential'))).toBe(true);
  });

  it('refuses a gap', () => {
    const issues = solutionIssues([
      position({ paragraphIndex: 2, falseInfoNumber: 1 }),
      position({ paragraphIndex: 5, falseInfoNumber: 3 }),
    ]);
    expect(issues.some((issue) => issue.includes('sequential'))).toBe(true);
  });

  it('refuses a duplicate number', () => {
    const issues = solutionIssues([
      position({ paragraphIndex: 2, falseInfoNumber: 1 }),
      position({ paragraphIndex: 5, falseInfoNumber: 1 }),
    ]);
    expect(issues.some((issue) => issue.includes('sequential'))).toBe(true);
  });

  // A broken generator should be diagnosed in one run, not one problem at a
  // time.
  it('reports every problem at once', () => {
    const issues = solutionIssues([
      position({ paragraphIndex: 9, falseInfoNumber: 2 }),
      position({ paragraphIndex: 0, falseInfoNumber: 5 }),
    ]);
    expect(issues).toHaveLength(3);
  });
});

describe('grading does not depend on the solution being sorted', () => {
  // Sorting is the generator's obligation (C3.3), not a precondition grading
  // gets to assume: a wrong answer because the input was unsorted would be the
  // worst possible failure mode here.
  it('grades an unsorted solution the same way', () => {
    const unsorted = [SOLUTION[2]!, SOLUTION[0]!, SOLUTION[1]!];
    expect(gradeAnswer(unsorted, [2, 3])).toEqual(gradeAnswer(SOLUTION, [2, 3]));
  });
});

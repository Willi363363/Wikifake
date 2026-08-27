// C3.3, and the correction itself.
//
// Two things live here: what a well-formed solution looks like, and what a
// player's marks are worth against it. They belong together because the second
// is only meaningful if the first holds — grading against positions that point
// at the wrong paragraphs is the project's worst historical bug (C3.1).
import type { FalsifiedPosition } from '@wikifake/protocol';

/**
 * The outcome of a submission, as paragraph indices rather than counts.
 *
 * `found.length` is the `truePositives` the scale takes, and `wrong.length` the
 * `falsePositives`. Keeping the indices means a debrief can say *which*
 * paragraph was missed, and a test can say which one the grading got wrong.
 *
 * All three are sorted ascending, so a grading is comparable to another.
 */
export interface Grading {
  /** Falsified paragraphs the player marked. */
  readonly found: readonly number[];
  /** Paragraphs the player marked that were not falsified. */
  readonly wrong: readonly number[];
  /** Falsified paragraphs the player did not mark. */
  readonly missed: readonly number[];
}

/**
 * Confronts the marked paragraphs with the solution.
 *
 * **Duplicates count once.** `check_answer` counts them as many times as they
 * appear, so marking the same paragraph three times scores it three times — 450
 * points for one paragraph. Nothing in the protocol forbids the repeat, so this
 * is closed here rather than by trusting the client not to try.
 *
 * An index that matches no paragraph at all is simply wrong: it cannot be a
 * falsification, so it costs what marking a clean paragraph costs. Refusing the
 * whole submission over it would lose an honest player their round.
 */
export function gradeAnswer(
  solution: readonly FalsifiedPosition[],
  marked: readonly number[],
): Grading {
  const falsified = new Set(solution.map((position) => position.paragraphIndex));
  const unique = new Set(marked);

  const ascending = (a: number, b: number): number => a - b;

  return {
    found: [...unique].filter((index) => falsified.has(index)).sort(ascending),
    wrong: [...unique].filter((index) => !falsified.has(index)).sort(ascending),
    missed: [...falsified].filter((index) => !unique.has(index)).sort(ascending),
  };
}

/**
 * C3.3 — what is wrong with this solution, in plain sentences.
 *
 * Empty means well formed. The generator of phase 3 is what has to satisfy this,
 * and the rule is written here because grading is what depends on it: a solution
 * whose numbers skip a value cannot be hinted at coherently, and one that is not
 * sorted makes a debrief list its paragraphs out of order.
 *
 * Returns every problem rather than the first, so a broken generator is
 * diagnosed in one run.
 */
export function solutionIssues(solution: readonly FalsifiedPosition[]): string[] {
  const issues: string[] = [];

  if (solution.length === 0) return ['a round has at least one falsification'];

  const indices = solution.map((position) => position.paragraphIndex);
  const numbers = solution.map((position) => position.falseInfoNumber);

  for (const [at, index] of indices.entries()) {
    if (!Number.isInteger(index) || index < 1) {
      issues.push(`position ${at}: paragraphIndex ${index} is not a 1-based paragraph`);
    }
  }

  if (new Set(indices).size !== indices.length) {
    issues.push('two falsifications point at the same paragraph');
  }

  const sorted = [...indices].sort((a, b) => a - b);
  if (indices.some((index, at) => index !== sorted[at])) {
    issues.push('positions are not sorted by ascending paragraph index');
  }

  const expected = solution.map((_position, at) => at + 1);
  if (numbers.some((number, at) => number !== expected[at])) {
    issues.push(`falseInfoNumber is not sequential from 1 to ${solution.length}`);
  }

  return issues;
}

/** C3.3 — whether the solution can be graded and hinted at coherently. */
export function isWellFormedSolution(solution: readonly FalsifiedPosition[]): boolean {
  return solutionIssues(solution).length === 0;
}

'use client';

// C1.2 — what each paragraph turned out to be, once the round is over.
//
// `gradeAnswer` is `@wikifake/domain`'s, and it is the same function the server
// graded with. Not for economy: a debrief that decided for itself which marks
// were right would be a second opinion on the score the player was given, and
// the two would disagree the first time either changed.
import { gradeAnswer } from '@wikifake/domain';
import type { FalsifiedPosition } from '@wikifake/protocol';

/** The three states a paragraph can end in. `TokenState`'s verdicts, by name. */
export type Verdict = 'found' | 'missed' | 'false-positive';

/**
 * Every paragraph with something to say about it, by 1-based index.
 *
 * A paragraph nobody marked and nothing falsified is absent: it has no verdict,
 * and `tokenStateFor` renders absence as `idle`.
 */
export function verdictsFor(
  solution: readonly FalsifiedPosition[],
  marked: readonly number[],
): ReadonlyMap<number, Verdict> {
  const graded = gradeAnswer(solution, marked);
  const verdicts = new Map<number, Verdict>();

  for (const at of graded.found) verdicts.set(at, 'found');
  for (const at of graded.missed) verdicts.set(at, 'missed');
  for (const at of graded.wrong) verdicts.set(at, 'false-positive');

  return verdicts;
}

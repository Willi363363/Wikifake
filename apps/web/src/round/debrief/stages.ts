'use client';

// The reveal, as a sequence rather than as two guesses.
//
// The current debrief waits 5,400 ms and then shows its statistics. The ranking
// it is waiting for runs `[800, 1300, 1100, 1000, 900]`, which is 5,100 — so the
// 5,400 is 5,100 plus a margin somebody chose by watching it. Change one stage
// and the two drift apart silently: the statistics appear over an animation that
// is still running, or after a pause nobody can explain.
//
// So the schedule is **data**, one place, and the animation says when it is done.
// Nothing waits on a number it did not compute.
import type { ScoreBreakdown } from '@wikifake/protocol';
import { PER_FALSE_POSITIVE, PER_TRUE_POSITIVE } from '@wikifake/domain';

export interface Stage {
  readonly label: string;
  readonly note: string;
  /** How long this stage holds before the next, in milliseconds. */
  readonly holds: number;
}

/**
 * The five stages, and the current game's timings.
 *
 * Stage 0 is the warm-up: nothing has been added up yet. The scores at each
 * stage are cumulative, which is what makes the numbers climb.
 */
export const STAGES: readonly Stage[] = [
  {
    label: 'Tallying corrections',
    note: 'What each falsification found is worth',
    holds: 800,
  },
  { label: 'Applying penalties', note: 'Paragraphs marked for nothing', holds: 1300 },
  { label: 'Counting intel', note: 'What the hints cost', holds: 1100 },
  { label: 'Awarding the time bonus', note: 'What was left on the clock', holds: 1000 },
  { label: 'Final ranking', note: 'Round complete', holds: 900 },
];

/** How long the whole sequence takes. Derived, so it cannot disagree. */
export function durationOf(stages: readonly Stage[] = STAGES): number {
  return stages.reduce((total, stage) => total + stage.holds, 0);
}

/**
 * The score as of a stage, from the breakdown the server sent.
 *
 * The scale is `@wikifake/domain`'s. The current component reads its own copy in
 * `frontend/src/config.js`, which is the second opinion this package exists to
 * remove — and a debrief that adds up to a different number from the one the
 * server stored is a debrief nobody can argue with.
 */
export function scoreAtStage(breakdown: ScoreBreakdown, stage: number): number {
  let score = 0;
  if (stage >= 1) score += breakdown.truePositives * PER_TRUE_POSITIVE;
  if (stage >= 2) score -= breakdown.falsePositives * PER_FALSE_POSITIVE;
  if (stage >= 3) score -= breakdown.hintPenalty + breakdown.scoreStolen;
  if (stage >= 4) score += breakdown.timeBonus;
  return score;
}

/**
 * How well the player did, as one number in `[0,1]`.
 *
 * The harmonic mean of precision and recall — the current debrief's F1, kept,
 * because it is the one figure that punishes both marking everything and marking
 * nothing. `null` when there is nothing to measure.
 */
export function accuracyOf(breakdown: ScoreBreakdown, totalFakes: number): number | null {
  const marked = breakdown.truePositives + breakdown.falsePositives;
  if (marked === 0 && totalFakes === 0) return null;

  const precision = marked === 0 ? 0 : breakdown.truePositives / marked;
  const recall = totalFakes === 0 ? 0 : breakdown.truePositives / totalFakes;
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

export interface Grade {
  readonly label: string;
  readonly note: string;
  readonly tone: 'green' | 'accent' | 'bronze' | 'danger';
}

/** The four bands of the current debrief, with its thresholds. */
export function gradeFor(accuracy: number | null): Grade {
  if (accuracy === null || accuracy < 0.5) {
    return { label: 'Taken in', note: 'Try another article', tone: 'danger' };
  }
  if (accuracy < 0.75)
    return { label: 'Promising', note: 'Getting there', tone: 'bronze' };
  if (accuracy < 0.95) return { label: 'Strong', note: 'Hard to fool', tone: 'accent' };
  return { label: 'Outstanding', note: 'Nothing got past you', tone: 'green' };
}

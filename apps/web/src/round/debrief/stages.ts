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

/** The catalogue entry a stage reads its label and note from. */
export type StageId = 'corrections' | 'penalties' | 'intel' | 'timeBonus' | 'final';

export interface Stage {
  /** What the stage is; the copy lives at `debrief.stages.<id>`. */
  readonly id: StageId;
  /** How long this stage holds before the next, in milliseconds. */
  readonly holds: number;
}

/**
 * The five stages, and the current game's timings.
 *
 * Stage 0 is the warm-up: nothing has been added up yet. The scores at each
 * stage are cumulative, which is what makes the numbers climb. Since step 11.2
 * a stage carries an identifier and not its copy: the sentences live in the
 * catalogue, and this module keeps only the schedule.
 */
export const STAGES: readonly Stage[] = [
  { id: 'corrections', holds: 800 },
  { id: 'penalties', holds: 1300 },
  { id: 'intel', holds: 1100 },
  { id: 'timeBonus', holds: 1000 },
  { id: 'final', holds: 900 },
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

/** The catalogue entry a grade reads its label and note from. */
export type GradeId = 'takenIn' | 'promising' | 'strong' | 'outstanding';

export interface Grade {
  /** Which band it is; the copy lives at `debrief.grade.<id>`. */
  readonly id: GradeId;
  readonly tone: 'green' | 'accent' | 'bronze' | 'danger';
}

/** The four bands of the current debrief, with its thresholds. */
export function gradeFor(accuracy: number | null): Grade {
  if (accuracy === null || accuracy < 0.5) return { id: 'takenIn', tone: 'danger' };
  if (accuracy < 0.75) return { id: 'promising', tone: 'bronze' };
  if (accuracy < 0.95) return { id: 'strong', tone: 'accent' };
  return { id: 'outstanding', tone: 'green' };
}

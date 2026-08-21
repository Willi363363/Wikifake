/**
 * Score display.
 *
 * The client no longer knows which paragraphs are sabotaged during the round,
 * so it cannot count true or false positives: the authoritative breakdown is
 * computed by the backend and arrives with `game_end` (multiplayer) or with
 * the submit response (solo).
 *
 * Two shapes are exposed:
 *  - `useLiveScore`  — optimistic number shown while playing.
 *  - `finalStats`    — the debrief numbers, derived from the server breakdown.
 */
import { useMemo } from 'react';
import { SCORING } from '../../config.js';

/**
 * The optimistic score broadcast to rivals during the round.
 *
 * It deliberately counts every mark as correct — players must not be able to
 * read the answer key off someone else's live score.
 */
export function useLiveScore({ markedCount, hintPenalty }) {
  return useMemo(
    () => markedCount * SCORING.perCorrect - hintPenalty,
    [markedCount, hintPenalty],
  );
}

const EMPTY_BREAKDOWN = { tp: 0, fp: 0, hintsUsed: 0, hintPenalty: 0, scoreStolen: 0, timeBonus: 0 };

/**
 * Debrief numbers, from the server's own arithmetic.
 *
 * @param breakdown  Server breakdown (`tp`, `fp`, `hintPenalty`, `timeBonus`…).
 * @param totalFakes How many paragraphs were sabotaged.
 * @param sessionId  Label shown in the debrief header.
 */
export function finalStats(breakdown, totalFakes, sessionId) {
  const b = { ...EMPTY_BREAKDOWN, ...(breakdown || {}) };

  const precision = (b.tp + b.fp) === 0 ? 0 : b.tp / (b.tp + b.fp);
  const recall = totalFakes === 0 ? 0 : b.tp / totalFakes;
  const f1 = (precision + recall) === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const baseScore = b.tp * SCORING.perCorrect;
  const fpPenalty = b.fp * SCORING.perFalsePositive;

  return {
    truePositives: b.tp,
    falsePositives: b.fp,
    missed: Math.max(0, totalFakes - b.tp),
    f1,
    totalFakes,
    baseScore,
    fpPenalty,
    hintPenalty: b.hintPenalty,
    timeBonus: b.timeBonus,
    finalScore: baseScore - fpPenalty - b.hintPenalty - (b.scoreStolen || 0) + b.timeBonus,
    sessionId,
  };
}

/** Hook wrapper, so the debrief re-renders only when the breakdown changes. */
export function useFinalStats(breakdown, totalFakes, sessionId) {
  return useMemo(
    () => finalStats(breakdown, totalFakes, sessionId),
    [breakdown, totalFakes, sessionId],
  );
}

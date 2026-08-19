/**
 * Client-side scoring.
 *
 * The backend recomputes the authoritative score on submit; this mirror exists
 * so the HUD, the live leaderboard and the debrief can show numbers before the
 * server answers. The arithmetic is kept in sync through `SCORING` in config.
 */
import { useMemo } from 'react';
import { SCORING } from '../../config.js';

/**
 * Full breakdown for the debrief.
 * @param fakes  article.fakes — the tokens that are actually sabotaged
 */
export function useScore({ marked, edited, fakes, time, hintPenalty, scoreStolen, sessionId }) {
  return useMemo(() => {
    const selected = new Set([...Object.keys(marked), ...Object.keys(edited)]);
    const fakeTokenIds = new Set(fakes.map((f) => f.tokenId));

    let truePositives = 0;
    let falsePositives = 0;
    for (const id of selected) {
      if (fakeTokenIds.has(id)) truePositives += 1;
      else falsePositives += 1;
    }

    const totalFakes = fakes.length;
    const missed = totalFakes - truePositives;

    const precision = (truePositives + falsePositives) === 0
      ? 0 : truePositives / (truePositives + falsePositives);
    const recall = totalFakes === 0 ? 0 : truePositives / totalFakes;
    const f1 = (precision + recall) === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    const baseScore = truePositives * SCORING.perCorrect;
    const fpPenalty = falsePositives * SCORING.perFalsePositive;
    const timeBonus = Math.max(0, Math.floor(time * SCORING.timeBonusPerSecond));

    return {
      truePositives, falsePositives, missed, f1, totalFakes,
      baseScore, fpPenalty, hintPenalty, timeBonus,
      finalScore: baseScore - fpPenalty - hintPenalty - scoreStolen + timeBonus,
      sessionId,
    };
  }, [marked, edited, fakes, time, hintPenalty, scoreStolen, sessionId]);
}

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

import { describe, expect, it } from 'vitest';

import { SCORING } from '../../../config.js';
import { finalStats } from '../useScore.js';

const BREAKDOWN = {
  tp: 3, fp: 1, hintsUsed: 2, hintPenalty: 100, scoreStolen: 50, timeBonus: 60,
};

describe('finalStats', () => {
  it('reprend les chiffres du serveur', () => {
    const stats = finalStats(BREAKDOWN, 4, 'ROOM42');
    expect(stats.truePositives).toBe(3);
    expect(stats.falsePositives).toBe(1);
    expect(stats.missed).toBe(1);
    expect(stats.hintPenalty).toBe(100);
    expect(stats.timeBonus).toBe(60);
    expect(stats.sessionId).toBe('ROOM42');
  });

  it('recompose le score avec le barème partagé', () => {
    const stats = finalStats(BREAKDOWN, 4, 'X');
    expect(stats.baseScore).toBe(3 * SCORING.perCorrect);
    expect(stats.fpPenalty).toBe(SCORING.perFalsePositive);
    expect(stats.finalScore).toBe(
      3 * SCORING.perCorrect - SCORING.perFalsePositive - 100 - 50 + 60,
    );
  });

  it('tolère un barème absent (partie non soumise)', () => {
    const stats = finalStats(null, 4, 'X');
    expect(stats.truePositives).toBe(0);
    expect(stats.missed).toBe(4);
    expect(stats.finalScore).toBe(0);
  });

  it('calcule un F1 de 1 pour un sans-faute', () => {
    expect(finalStats({ tp: 4, fp: 0 }, 4, 'X').f1).toBe(1);
  });

  it('calcule un F1 de 0 sans détection', () => {
    expect(finalStats({ tp: 0, fp: 3 }, 4, 'X').f1).toBe(0);
  });

  it('ne divise pas par zéro sans falsification', () => {
    expect(finalStats({ tp: 0, fp: 0 }, 0, 'X').f1).toBe(0);
  });
});

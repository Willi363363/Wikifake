import { describe, expect, it } from 'vitest';

import {
  accuracyScore,
  normalizeBreakdown,
  scoreAtStage,
  stageDelta,
} from '../breakdown';

const SERVER_BREAKDOWN = {
  hits: 3,
  false_positives: 1,
  missed: 1,
  base_points: 450,
  false_positive_penalty: 80,
  hints_used: 2,
  hint_penalty: 100,
  stolen_points: 50,
  time_bonus: 60,
  total: 280,
};

describe('normalizeBreakdown', () => {
  it('traduit les cles serveur en camelCase', () => {
    expect(normalizeBreakdown(SERVER_BREAKDOWN)).toEqual({
      hits: 3,
      falsePositives: 1,
      missed: 1,
      basePoints: 450,
      falsePositivePenalty: 80,
      hintsUsed: 2,
      hintPenalty: 100,
      stolenPoints: 50,
      timeBonus: 60,
      total: 280,
    });
  });

  it('tolere un breakdown absent', () => {
    expect(normalizeBreakdown(null).total).toBe(0);
    expect(normalizeBreakdown(undefined).hits).toBe(0);
  });
});

describe('scoreAtStage', () => {
  it('devoile le score par etapes', () => {
    expect(scoreAtStage(SERVER_BREAKDOWN, 0)).toBe(0);
    expect(scoreAtStage(SERVER_BREAKDOWN, 1)).toBe(450);
    expect(scoreAtStage(SERVER_BREAKDOWN, 2)).toBe(370);
    expect(scoreAtStage(SERVER_BREAKDOWN, 3)).toBe(220);
    expect(scoreAtStage(SERVER_BREAKDOWN, 4)).toBe(280);
  });

  it("utilise le total du serveur a la derniere etape, jamais un recalcul", () => {
    const divergent = { ...SERVER_BREAKDOWN, total: 12345 };
    expect(scoreAtStage(divergent, 5)).toBe(12345);
  });
});

describe('stageDelta', () => {
  it('affiche +0 quand il n y a pas de malus', () => {
    const clean = { ...SERVER_BREAKDOWN, false_positive_penalty: 0 };
    expect(stageDelta(clean, 2).value).toBe('±0');
  });

  it('cumule indices et pillages', () => {
    expect(stageDelta(SERVER_BREAKDOWN, 3).value).toBe('−150');
  });
});

describe('accuracyScore', () => {
  it('vaut 1 pour un sans-faute', () => {
    expect(accuracyScore({ hits: 4, false_positives: 0 }, 4)).toBe(1);
  });

  it('vaut 0 sans detection', () => {
    expect(accuracyScore({ hits: 0, false_positives: 3 }, 4)).toBe(0);
  });
});

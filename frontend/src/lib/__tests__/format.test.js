import { describe, expect, it } from 'vitest';

import { formatClock, formatDuration, plural, signed } from '../format';

describe('formatClock', () => {
  it('formate en mm:ss', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(600)).toBe('10:00');
  });

  it('ne descend jamais sous zero', () => {
    expect(formatClock(-30)).toBe('00:00');
  });
});

describe('formatDuration', () => {
  it('bascule en minutes au-dela de 60s', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(180)).toBe('3.0min');
  });
});

describe('helpers', () => {
  it('accorde les pluriels', () => {
    expect(plural(1, 'erreur')).toBe('erreur');
    expect(plural(2, 'erreur')).toBe('erreurs');
  });

  it('signe les entiers', () => {
    expect(signed(5)).toBe('+5');
    expect(signed(-5)).toBe('-5');
  });
});

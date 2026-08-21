import { beforeEach, describe, expect, it } from 'vitest';

import { ACCENTS, accentOf, applyAccent } from '../accents';

describe('accents', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('retombe sur teal pour un nom inconnu', () => {
    expect(accentOf('inexistant')).toBe(ACCENTS.teal);
  });

  it('ecrit les variables CSS', () => {
    applyAccent('navy');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe(
      ACCENTS.navy.primary,
    );
  });
});

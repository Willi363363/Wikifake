import { describe, expect, it } from 'vitest';

import { articleStyle, classesFor, effectOf } from '@/features/effects/registry';

describe('registre des effets', () => {
  it('agrège les filtres CSS des effets actifs', () => {
    const style = articleStyle(['BLUR', 'INVERT']);
    expect(style.filter).toContain('blur(6px)');
    expect(style.filter).toContain('invert(1)');
  });

  it('renvoie "none" sans effet', () => {
    expect(articleStyle([]).filter).toBe('none');
  });

  it('bloque les interactions pendant BLUR', () => {
    expect(articleStyle(['BLUR']).pointerEvents).toBe('none');
    expect(articleStyle(['SPIN']).pointerEvents).toBe('auto');
  });

  it('applique la transformation MIRROR', () => {
    expect(articleStyle(['MIRROR']).transform).toBe('scaleX(-1)');
  });

  it('collecte les classes de carte et de corps', () => {
    expect(classesFor(['SPIN', 'EARTHQUAKE'], 'cardClasses')).toEqual([
      'spin-active',
      'earthquake-active',
    ]);
    expect(classesFor(['TINY'], 'bodyClasses')).toEqual(['tiny-active']);
  });

  it('tolère un item inconnu', () => {
    expect(effectOf('INCONNU')).toEqual({});
    expect(articleStyle(['INCONNU']).filter).toBe('none');
  });
});

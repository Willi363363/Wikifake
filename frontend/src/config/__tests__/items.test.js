import { describe, expect, it } from 'vitest';

import { ITEMS, getItemDef, isSelfTargeted, itemDuration } from '../items';
import { EFFECTS } from '@/features/effects/registry';

describe('catalogue partage', () => {
  it('charge shared/items.json', () => {
    expect(ITEMS.length).toBeGreaterThanOrEqual(10);
  });

  it('a des identifiants uniques', () => {
    const ids = ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ne renvoie jamais undefined', () => {
    expect(getItemDef('N_EXISTE_PAS').name).toBe('Item inconnu');
    expect(itemDuration('N_EXISTE_PAS')).toBe(0);
  });

  it('SCANNER se cible soi-meme', () => {
    expect(isSelfTargeted('SCANNER')).toBe(true);
    expect(isSelfTargeted('BLUR')).toBe(false);
  });

  it('chaque item du catalogue a une entree dans le registre d effets', () => {
    // Garde-fou : ajouter un item sans son effet visuel devient une erreur
    // de test, pas un bug silencieux en jeu.
    const missing = ITEMS.filter((item) => !(item.id in EFFECTS)).map((item) => item.id);
    expect(missing).toEqual([]);
  });
});

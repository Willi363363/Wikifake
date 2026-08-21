/**
 * Catalogue d'items.
 *
 * Importe directement `shared/items.json` : MEME SOURCE que le backend
 * (`app/rooms/items.py`). Ajouter un item = editer le JSON puis, s'il a un
 * effet visuel, l'enregistrer dans `features/effects/registry.js`.
 */

import catalogue from '@shared/items.json';

export const ITEMS = catalogue.items;

const BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

const UNKNOWN = {
  id: 'UNKNOWN',
  name: 'Item inconnu',
  icon: '?',
  description: '',
  targetCount: 1,
  durationMs: 0,
  color: '#27272a',
};

/** Definition d'un item, jamais `undefined` (evite les `|| {}` disperses). */
export function getItemDef(id) {
  return BY_ID.get(id) ?? UNKNOWN;
}

export function itemDuration(id) {
  return getItemDef(id).durationMs;
}

/** `true` si l'item s'applique a soi-meme (ex. SCANNER). */
export function isSelfTargeted(id) {
  return getItemDef(id).targetCount === 0;
}

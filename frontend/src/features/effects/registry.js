/**
 * Registre des effets d'items.
 *
 * Ajouter un malus visuel = ajouter une entree ici. `GameScreen` n'a plus
 * de chaine de 13 `else if` avec des `setTimeout` en dur : la duree vient
 * de `shared/items.json` et le rendu de `filters` / `classes`.
 *
 * - `overlay`  : composant plein ecran affiche pendant l'effet
 * - `filters`  : filtres CSS appliques a la carte de l'article
 * - `transform`: transformation CSS appliquee a la carte de l'article
 * - `classes`  : classes ajoutees a la carte ou au corps de l'article
 * - `sideEffect`: action non visuelle (retrait de temps, etc.)
 */

import Blackout from './Blackout';
import Blizzard from './Blizzard';
import Confetti from './Confetti';
import Earthquake from './Earthquake';
import Fog from './Fog';
import Lightning from './Lightning';
import Static from './Static';

export const EFFECTS = {
  FREEZE_TIME: { overlay: Blizzard },
  SCORE_STEAL: { overlay: Lightning },
  HINT_LOCK: { overlay: Static },
  BLUR: {
    overlay: Fog,
    filters: ['blur(6px)'],
    blocksInteraction: true,
  },
  EARTHQUAKE: { overlay: Earthquake, cardClasses: ['earthquake-active'] },
  BLACKOUT: { overlay: Blackout, bodyClasses: ['blackout-active'] },
  CONFETTI: { overlay: Confetti },
  INVERT: { filters: ['invert(1)', 'hue-rotate(180deg)'] },
  MIRROR: { transform: 'scaleX(-1)' },
  TINY: { bodyClasses: ['tiny-active'] },
  SPIN: { cardClasses: ['spin-active'] },
  RICKROLL: {}, // gere par RickrollModal (fermeture manuelle)
  SCANNER: {}, // pas d'effet visuel : le serveur renvoie un paragraphe
};

export function effectOf(itemId) {
  return EFFECTS[itemId] ?? {};
}

/** Agrege les styles des effets actifs pour la carte de l'article. */
export function articleStyle(activeIds) {
  const filters = [];
  let transform;
  let blocksInteraction = false;
  activeIds.forEach((id) => {
    const effect = effectOf(id);
    if (effect.filters) filters.push(...effect.filters);
    if (effect.transform) transform = effect.transform;
    if (effect.blocksInteraction) blocksInteraction = true;
  });
  return {
    filter: filters.length ? filters.join(' ') : 'none',
    transform,
    userSelect: blocksInteraction ? 'none' : 'auto',
    pointerEvents: blocksInteraction ? 'none' : 'auto',
  };
}

export function classesFor(activeIds, key) {
  return activeIds.flatMap((id) => effectOf(id)[key] ?? []);
}

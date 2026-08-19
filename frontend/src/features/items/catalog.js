/**
 * The sabotage items players can throw at each other in multiplayer.
 *
 * The backend owns the authoritative list (it decides what to hand out); this
 * catalog carries the client-side presentation and targeting rules. Item ids
 * must stay in sync with `backend/src/realtime/items.py`.
 */

/** `targetCount: 0` means the item resolves on the caster instead of a rival. */
export const ITEM_DEFS = {
  BLUR:        { icon: '👁', name: 'Brouillard',    description: "Floute l'écran d'un joueur 5s",    color: '#6b4e6f' },
  FREEZE_TIME: { icon: '⏸',  name: 'Gel du temps',  description: "Retire 10s au chrono d'un joueur", color: '#1f3a5f' },
  SCORE_STEAL: { icon: '⚡', name: 'Pillage',       description: 'Vole 50 pts à un joueur',          color: '#8c6d36' },
  HINT_LOCK:   { icon: '🔒', name: 'Brouilleur',    description: 'Bloque les hints 20s',             color: '#27272a' },
  BLACKOUT:    { icon: '⬛', name: 'Censure CIA',   description: "Censure le texte d'un joueur 5s",  color: '#18181b' },
  EARTHQUAKE:  { icon: '🌋', name: 'Séisme',        description: "Fait trembler l'écran 5s",         color: '#a64b48' },
  RICKROLL:    { icon: '🤡', name: 'Pop-up Spam',   description: 'Affiche un pop-up gênant',         color: '#b58f3a' },
  SCANNER:     { icon: '🔎', name: 'Détecteur',     description: 'Surligne un paragraphe suspect',   color: '#4a7a52', targetCount: 0 },
  MIRROR:      { icon: '🪞', name: 'Miroir',        description: "Inverse le texte de l'article 6s", color: '#4a6b8c' },
  TINY:        { icon: '🔬', name: 'Loupe cassée',  description: 'Rend le texte minuscule 8s',       color: '#7a5248' },
  SPIN:        { icon: '🌀', name: 'Tournis',       description: "Fait tourner l'article 4s",        color: '#4a6b8c' },
  CONFETTI:    { icon: '🎊', name: 'Fête surprise', description: 'Explosion de confettis 6s',        color: '#8c6d36' },
  INVERT:      { icon: '🌑', name: 'Négatif',       description: 'Inverse les couleurs 5s',          color: '#27272a' },
};

/** Presentation for an item id, tolerant of ids the client does not know yet. */
export function itemDef(id) {
  return ITEM_DEFS[id] || {};
}

/** True when the item is cast on the player themselves and needs no target. */
export function isSelfCast(id) {
  return itemDef(id).targetCount === 0;
}

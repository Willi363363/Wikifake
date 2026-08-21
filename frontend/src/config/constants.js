/**
 * Valeurs de repli utilisees avant que `/api/config` ait repondu.
 *
 * La verite vient du serveur (voir `net/api.js#fetchServerConfig`) : ces
 * constantes ne servent qu'au premier rendu.
 */

export const FALLBACK_CONFIG = {
  version: 'dev',
  llmConfigured: true,
  duration: { default: 180, min: 30, max: 600 },
  maxPlayers: 8,
  maxNameLength: 20,
  maxChatLength: 400,
  items: [],
  wsCommands: [],
};

/** Duree d'affichage d'une notification de malus. */
export const EFFECT_TOAST_MS = 4000;

/** Intervalle minimal entre deux envois de position de curseur. */
export const CURSOR_THROTTLE_MS = 60;

/** Intervalle d'envoi de la selection courante au serveur. */
export const SELECTION_SYNC_MS = 400;

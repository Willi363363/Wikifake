/**
 * Game-wide constants shared by every feature.
 *
 * Anything a designer or game-balancer might want to change lives here rather
 * than being buried inside a component.
 */

/** Fallback round length, in seconds, when the room does not specify one. */
export const GAME_DURATION = 300;

/** Path to the logo. Served from `frontend/public/` at the site root. */
export const LOGO_SRC = '/image.png';

/** Scoring weights. The backend applies the same numbers when it ranks a room. */
export const SCORING = {
  perCorrect: 150,
  perFalsePositive: 80,
  timeBonusPerSecond: 0.5,
  hintCost: 50,
  revealCost: 200,
};

/** Selectable accent palettes, applied to the document as CSS custom properties. */
export const ACCENTS = {
  teal:       { primary: '#1f574d', hover: '#174841', soft: '#e8f0ed', line: 'rgba(31, 87, 77, 0.18)' },
  navy:       { primary: '#1f3a5f', hover: '#162d4a', soft: '#e6ecf3', line: 'rgba(31, 58, 95, 0.18)' },
  bronze:     { primary: '#8c6d36', hover: '#735829', soft: '#f4ecdb', line: 'rgba(140, 109, 54, 0.20)' },
  aubergine:  { primary: '#6b4e6f', hover: '#553e58', soft: '#efe9f0', line: 'rgba(107, 78, 111, 0.20)' },
  graphite:   { primary: '#27272a', hover: '#18181b', soft: '#ececec', line: 'rgba(39, 39, 42, 0.18)' },
};

export const DEFAULT_ACCENT = 'teal';

/** Colour used for other players when the server did not assign one. */
export const NEUTRAL_PLAYER_COLOR = '#7a9460';

/** Initial values for the design-host tweak panel. */
export const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mode": "normal",
  "difficulty": "medium",
  "multiplayer": true,
  "gameState": "playing",
  "showCursors": true,
  "accent": "teal",
  "sessionId": "A2-F1K9"
}/*EDITMODE-END*/;

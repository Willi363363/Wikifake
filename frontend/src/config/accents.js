/** Palettes d'accentuation appliquees en variables CSS. */

export const ACCENTS = {
  teal: { primary: '#1f574d', hover: '#174841', soft: '#e8f0ed', line: 'rgba(31, 87, 77, 0.18)' },
  navy: { primary: '#1f3a5f', hover: '#162d4a', soft: '#e6ecf3', line: 'rgba(31, 58, 95, 0.18)' },
  bronze: { primary: '#8c6d36', hover: '#735829', soft: '#f4ecdb', line: 'rgba(140, 109, 54, 0.20)' },
  aubergine: { primary: '#6b4e6f', hover: '#553e58', soft: '#efe9f0', line: 'rgba(107, 78, 111, 0.20)' },
  graphite: { primary: '#27272a', hover: '#18181b', soft: '#ececec', line: 'rgba(39, 39, 42, 0.18)' },
};

export const ACCENT_OPTIONS = [
  { value: 'teal', label: 'Vert enqueteur' },
  { value: 'navy', label: 'Bleu editorial' },
  { value: 'bronze', label: 'Bronze' },
  { value: 'aubergine', label: 'Aubergine' },
  { value: 'graphite', label: 'Graphite' },
];

export const DEFAULT_ACCENT = 'teal';

export function accentOf(name) {
  return ACCENTS[name] ?? ACCENTS[DEFAULT_ACCENT];
}

/** Applique une palette sur `:root`. */
export function applyAccent(name) {
  const accent = accentOf(name);
  const root = document.documentElement.style;
  root.setProperty('--accent', accent.primary);
  root.setProperty('--accent-hover', accent.hover);
  root.setProperty('--accent-soft', accent.soft);
  root.setProperty('--accent-line', accent.line);
}

export const NEUTRAL_PLAYER_COLOR = '#7a9460';

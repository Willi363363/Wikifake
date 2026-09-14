'use client';

// Three surfaces on the chosen grid — step L.1, round five.
//
// The arrangement is settled, so these differ only in how a tile is finished
// and what colour carries the action. Three files would have let the grid
// drift; one file with three palettes cannot.
//
// **No gradient, no glow, no coloured shadow** — the three things that made
// round two read as generated. Depth here is a hairline or a fill, never light.
import { Bento } from './bento.js';
import type { Copy } from './copy.js';
import type { Skin } from './skin.js';
import type { Palette, Theme } from './tone.js';

const FACE = '"Inter", system-ui, -apple-system, "Segoe UI", Arial, sans-serif';

export interface VariantProps {
  readonly copy: Copy;
  readonly theme: Theme;
  readonly signedIn: boolean;
  readonly onAdminPage: boolean;
}

/** J1 — hairlines, one deep green, the quietest of the three. */
const QUIET: Palette = {
  light: {
    bg: '#F4F5F3',
    surface: '#FFFFFF',
    line: '#E2E4DF',
    ink: '#15181A',
    muted: '#6A7178',
    accent: '#0F7A5A',
    onAccent: '#FFFFFF',
    second: '#B45309',
    font: FACE,
  },
  dark: {
    bg: '#0E1113',
    surface: '#171B1E',
    line: '#262C31',
    ink: '#EDF0F2',
    muted: '#8B959D',
    accent: '#2DD4A0',
    onAccent: '#04140E',
    second: '#F5A524',
    font: FACE,
  },
};

/** J2 — no hairlines, flat blue, bigger figures. The tiles are the structure. */
export const J2: Palette = {
  light: {
    bg: '#EEF1F6',
    surface: '#FFFFFF',
    line: '#DDE3EC',
    ink: '#111827',
    muted: '#5B6675',
    accent: '#2557E6',
    onAccent: '#FFFFFF',
    second: '#C2410C',
    font: FACE,
  },
  dark: {
    bg: '#0B0F17',
    surface: '#141B26',
    line: '#1F2A38',
    ink: '#E8EDF4',
    muted: '#8494A8',
    accent: '#4C82F7',
    onAccent: '#060B14',
    second: '#F59E0B',
    font: FACE,
  },
};

/** J3 — tight radius, dense type, warm ink, a red that is never shaded. */
const DENSE: Palette = {
  light: {
    bg: '#FAF8F4',
    surface: '#FFFFFF',
    line: '#E4DED2',
    ink: '#1A1713',
    muted: '#6E665A',
    accent: '#C0362B',
    onAccent: '#FFFFFF',
    second: '#1F6F5C',
    font: FACE,
  },
  dark: {
    bg: '#121110',
    surface: '#1B1917',
    line: '#2C2825',
    ink: '#EDE9E2',
    muted: '#948C80',
    accent: '#E45B4C',
    onAccent: '#140705',
    second: '#4FBFA3',
    font: FACE,
  },
};

const SKINS: Record<'quiet' | 'flat' | 'dense', Skin> = {
  quiet: {
    radius: 'rounded-xl',
    gap: 'gap-3',
    pad: 'p-4',
    bordered: true,
    fill: 'surface',
    figure: 'text-[26px]',
    label: 'text-[12px]',
    body: 'text-[13px]',
  },
  flat: {
    radius: 'rounded-2xl',
    gap: 'gap-4',
    pad: 'p-5',
    bordered: false,
    fill: 'surface',
    figure: 'text-[34px]',
    label: 'text-[13px]',
    body: 'text-[14px]',
  },
  dense: {
    radius: 'rounded-md',
    gap: 'gap-2',
    pad: 'p-3',
    bordered: true,
    fill: 'page',
    figure: 'text-[22px]',
    label: 'text-[11px]',
    body: 'text-[12.5px]',
  },
};

export function VariantQuiet(props: VariantProps) {
  return (
    <Bento {...props} tone={QUIET[props.theme]} skin={SKINS.quiet} menuId="j1-menu" />
  );
}

export const FLAT_SKIN = SKINS.flat;

export function VariantFlat(props: VariantProps) {
  return <Bento {...props} tone={J2[props.theme]} skin={SKINS.flat} menuId="j2-menu" />;
}

export function VariantDense(props: VariantProps) {
  return (
    <Bento {...props} tone={DENSE[props.theme]} skin={SKINS.dense} menuId="j3-menu" />
  );
}

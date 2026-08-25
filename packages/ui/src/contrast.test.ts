// The contrast audit, and what it found.
//
// It found that the palette this phase transcribes does not pass. Three pairs
// are below three to one — unusable for text at any size — and four more clear
// three but not four and a half. The dark palette, which is this phase's own
// invention and has no identity to preserve, passes everywhere.
//
// Nothing is quietly adjusted here. "No redesign" is one of the phase's own
// pitfalls and these are the current game's colours, shipped today; changing
// them is a decision about how the game looks, and that is not a decision a
// transcription gets to take. So the failures are **named**, with their numbers,
// and this test fails if a new one appears *or* if a named one is fixed without
// the list being updated — drift in either direction is caught.
//
// The worst of them is worth reading twice: `warn` on `warn-soft` is 2.56, and
// that pair is the MISSED verdict. The debrief tells a player which
// falsifications they let through in amber on amber.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  auditContrast,
  contrastRatio,
  CONTRAST_PAIRS,
  gradeOf,
  over,
  parseColour,
  relativeLuminance,
} from './contrast.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = readFileSync(join(HERE, 'theme.css'), 'utf8');

/** The `--color-*` declarations of one block of the stylesheet. */
function paletteIn(opener: string): (token: string) => string {
  const start = THEME.indexOf(opener);
  let depth = 0;
  let end = THEME.length;
  for (let at = THEME.indexOf('{', start); at < THEME.length; at += 1) {
    if (THEME[at] === '{') depth += 1;
    if (THEME[at] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = at;
        break;
      }
    }
  }

  const body = THEME.slice(THEME.indexOf('{', start) + 1, end);
  const found = new Map<string, string>();
  for (const match of body.matchAll(/--color-([\w-]+)\s*:\s*([^;]+);/g)) {
    found.set(match[1] as string, (match[2] as string).trim());
  }
  return (token) => found.get(token) ?? '';
}

const light = auditContrast(paletteIn('@theme static {'));
const dark = auditContrast(paletteIn('.dark {'));

const at = (results: readonly { fg: string; bg: string; ratio: number }[], key: string) =>
  results.find((result) => `${result.fg} on ${result.bg}` === key);

/**
 * What the light palette fails, today, to two decimals.
 *
 * Inherited from `frontend/src/styles/tokens.css`, not introduced here. Each is
 * a decision waiting: raising `warn` to reach 4.5 on its own wash changes what
 * the debrief looks like, and that is the user's call rather than a
 * transcription's.
 */
const INHERITED: Readonly<Record<string, number>> = {
  'muted-2 on bg': 2.33,
  'muted-2 on surface': 2.56,
  'warn on warn-soft': 2.56,
  'muted on bg': 4.4,
  'bronze on bg': 4.39,
  'bronze on bronze-soft': 4.1,
  'green on green-soft': 4.26,
};

describe('the maths', () => {
  it('reads every shape a colour arrives in', () => {
    expect(parseColour('#18181b')).toEqual({ r: 24, g: 24, b: 27, a: 1 });
    expect(parseColour('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColour('rgba(24, 24, 27, 0.07)')).toEqual({
      r: 24,
      g: 24,
      b: 27,
      a: 0.07,
    });
    // What a browser hands back for the same declaration.
    expect(parseColour('rgb(24 24 27 / 7%)')).toEqual({ r: 24, g: 24, b: 27, a: 0.07 });
    expect(parseColour('color-mix(in srgb, red, blue)')).toBeNull();
  });

  // The two anchors of the scale, and the reason a ratio is trustworthy at all.
  it('agrees with WCAG at the extremes', () => {
    const white = { r: 255, g: 255, b: 255, a: 1 };
    const black = { r: 0, g: 0, b: 0, a: 1 };
    expect(relativeLuminance(white)).toBeCloseTo(1, 5);
    expect(relativeLuminance(black)).toBeCloseTo(0, 5);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 2);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  // A ratio computed against a colour with an alpha channel is a ratio computed
  // against a colour nobody sees.
  it('flattens a translucent colour onto what is behind it', () => {
    const half = { r: 0, g: 0, b: 0, a: 0.5 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    expect(over(half, white)).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
    expect(over(white, half)).toEqual(white);
  });

  it('grades a ratio the way WCAG does', () => {
    expect(gradeOf(4.5)).toBe('AA');
    expect(gradeOf(4.49)).toBe('large');
    expect(gradeOf(3)).toBe('large');
    expect(gradeOf(2.99)).toBe('fail');
  });
});

describe('6.6 — the audit', () => {
  it('measures every pair the design system renders', () => {
    expect(light).toHaveLength(CONTRAST_PAIRS.length);
    expect(light.every((result) => result.ratio > 1)).toBe(true);
  });

  // This phase's own invention, and it has no identity to preserve. It passes.
  describe('the dark palette', () => {
    it.each(dark)('$fg on $bg — $use', (result) => {
      // The ratio is in the message, so a failure says how far short it fell
      // rather than only that it did.
      expect({
        pair: `${result.fg} on ${result.bg}`,
        ratio: Number(result.ratio.toFixed(2)),
        needs: result.needs,
        passes: result.passes,
      }).toMatchObject({ passes: true });
    });
  });

  describe('the light palette', () => {
    it('fails exactly the pairs inherited from the current game', () => {
      const failing = light
        .filter((result) => !result.passes)
        .map((result) => `${result.fg} on ${result.bg}`)
        .sort();
      expect(failing).toEqual(Object.keys(INHERITED).sort());
    });

    // Pinned to two decimals, so a change to any of these colours is visible in
    // a diff rather than discovered later.
    it.each(Object.entries(INHERITED))('%s is still %s', (key, ratio) => {
      expect(at(light, key)?.ratio).toBeCloseTo(ratio, 2);
    });

    it('passes everything else', () => {
      const passing = light.filter((result) => result.passes);
      expect(passing.length).toBe(CONTRAST_PAIRS.length - Object.keys(INHERITED).length);
    });

    // The three that are not merely short of AA but unusable for text at any
    // size. `warn on warn-soft` is the MISSED verdict in the debrief.
    it('has three pairs below three to one, and names them', () => {
      const unusable = light
        .filter((result) => result.grade === 'fail')
        .map((result) => `${result.fg} on ${result.bg}`)
        .sort();
      expect(unusable).toEqual(
        ['muted-2 on bg', 'muted-2 on surface', 'warn on warn-soft'].sort(),
      );
    });
  });
});

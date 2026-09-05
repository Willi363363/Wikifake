// The contrast audit, and what it found.
//
// It found that the palette this phase transcribed did not pass: three pairs
// below three to one — unusable for text at any size — and four more clearing
// three but not four and a half. The dark palette, which is this phase's own
// invention and had no identity to preserve, passed everywhere.
//
// The seven are repaired, and the repair was a decision rather than a tidy-up.
// "No redesign" is one of phase 6's own pitfalls, and it was the right one while
// the transcription was in flight: adjusting the colours then would have been a
// transcription quietly taking a decision that was not its own. The decision has
// since been taken, so the correction lands here instead of being deferred.
//
// It is the smallest correction that works. Five solids had their luminosity
// scaled by a single factor each, which leaves the hue and the saturation
// exactly as transcribed — ×0.98 for `muted`, ×0.96 for `green`, ×0.94 for
// `bronze`, ×0.85 for `muted-2`, ×0.72 for `warn`. Four of those are invisible.
// No wash moved at all.
//
// The washes were the tempting half, and they were measured before being ruled
// out. `warn` on `warn-soft` was the worst pair at 2.56 — and that pair is the
// MISSED verdict, the debrief telling a player which falsifications they let
// through, in amber on amber. Lightening the wash to share the correction buys
// almost nothing: 60% lighter lets `warn` back up only from ×0.72 to ×0.77, and
// costs the wash its distinction from the page — 1.03:1 against a background it
// has to read as a panel on. So the solid moved and the wash stayed.
//
// What this test now holds is the result, pinned: every pair passes, and the
// seven that were repaired are pinned to two decimals so that a change to any of
// these colours shows up as a failing number rather than as a discovery.
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
 * Every ratio, pinned to two decimals, in both palettes.
 *
 * Phase 6 pinned only the seven pairs it had repaired, because the rest were
 * inherited and nobody had decided them. Nothing is inherited any more: the
 * brutalist palette was chosen against this audit before a line of it reached
 * the stylesheet, and `plans/product/01-palette.md` carries the same forty
 * numbers. So all forty are pinned here.
 *
 * What that buys is direction. An unpinned pair only says *still above the
 * threshold*, which stays true while a colour drifts a long way. A pinned one
 * says *this colour changed*, and the diff of this file is the record of what
 * changed and by how much.
 *
 * The five `on-fill` rows are identical between the palettes on purpose — the
 * fills do not move, so neither do their ratios. A number that stopped being
 * identical would mean a fill drifted in one palette, which `theme.test.ts`
 * also catches from the other side.
 */
const PINNED: Readonly<Record<string, readonly [number, number]>> = {
  // pair                            light   dark
  'ink on bg': [20.46, 16.86],
  'ink on surface': [21.0, 15.51],
  'ink on bg-grain': [18.08, 15.82],
  'ink-2 on bg': [13.59, 12.26],
  'ink-2 on surface': [13.95, 11.28],
  'muted on bg': [7.37, 7.52],
  'muted on surface': [7.57, 6.92],
  // `muted-2` is held to three rather than four and a half because the
  // palette's own role line declares it large text only. That is the floor
  // `CONTRAST_PAIRS` gives it, and it is not a discount taken here.
  'muted-2 on bg': [5.18, 5.14],
  'muted-2 on surface': [5.32, 4.73],

  'on-fill on accent': [16.13, 16.13],
  'on-fill on accent-line': [13.65, 13.65],
  'on-fill on bronze': [10.45, 10.45],
  'on-fill on green': [12.52, 12.52],
  'on-fill on warn': [11.48, 11.48],
  // The tightest pair in the palette, at ×1.54 of its target. `danger` is the
  // darkest fill, and darkening it further to look more alarming is the change
  // that breaks this row first.
  'on-fill on danger': [6.94, 6.94],

  'ink on accent-soft': [19.31, 11.4],
  'ink on bronze-soft': [17.43, 13.27],
  'ink on green-soft': [18.46, 12.73],
  'ink on warn-soft': [17.96, 12.36],
  'ink on danger-soft': [16.76, 14.26],
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

  // Held exactly as the dark palette is: same assertion, same shape, no clause
  // excusing the palette that happens to be inherited.
  describe('the light palette', () => {
    it.each(light)('$fg on $bg — $use', (result) => {
      expect({
        pair: `${result.fg} on ${result.bg}`,
        ratio: Number(result.ratio.toFixed(2)),
        needs: result.needs,
        passes: result.passes,
      }).toMatchObject({ passes: true });
    });

    it('passes every pair, with nothing exempted', () => {
      expect(light.filter((result) => result.passes)).toHaveLength(CONTRAST_PAIRS.length);
    });

    // The floor under the floor: `large` excuses a pair from 4.5, never from 3.
    it('has nothing below three to one', () => {
      const unusable = light
        .filter((result) => result.grade === 'fail')
        .map((result) => `${result.fg} on ${result.bg}`);
      expect(unusable).toEqual([]);
    });
  });

  describe('the pinned ratios', () => {
    // A pin nobody measures is a pin that rots. This is what makes the table
    // above a claim about the stylesheet rather than a list of numbers.
    it('names every pair the audit renders, and only those', () => {
      expect(Object.keys(PINNED).sort()).toEqual(
        CONTRAST_PAIRS.map((pair) => `${pair.fg} on ${pair.bg}`).sort(),
      );
    });

    it.each(Object.entries(PINNED))('%s', (key, [inLight, inDark]) => {
      expect(at(light, key)?.ratio).toBeCloseTo(inLight, 2);
      expect(at(dark, key)?.ratio).toBeCloseTo(inDark, 2);
    });

    // The fills are the same colour in both palettes, so their ratios are the
    // same number twice. Stated as its own assertion because it is a design
    // decision, and a decision that quietly stopped holding should fail.
    it('measures each fill identically in both palettes', () => {
      for (const [key, [inLight, inDark]] of Object.entries(PINNED)) {
        if (key.startsWith('on-fill on ')) expect(inLight).toBe(inDark);
      }
    });
  });
});

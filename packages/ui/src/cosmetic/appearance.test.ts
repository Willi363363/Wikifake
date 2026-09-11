// What a cosmetic looks like — step H.6.
//
// The claim worth testing is not that the mapping has an entry per identifier,
// though it does. It is the rule that makes selling colours safe at all:
//
//   **a cosmetic may only colour a decoration that carries no text**, and that
//   decoration has to be visible on both grounds.
//
// So the colours are measured against `theme.css` — the real stylesheet, read
// here rather than transcribed — with WCAG 1.4.11's 3:1, which is the right bar
// for a rectangle and the wrong one for a word.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DECORATION_GROUNDS,
  FRAMES,
  MARKER_COLOURS,
  MARK_STYLES,
  NON_TEXT_CONTRAST,
  frameFor,
  isVisibleDecoration,
  markStyleFor,
  markerColourFor,
} from './appearance.js';
import { contrastRatio, parseColour } from '../contrast.js';

/**
 * The stylesheet, read through a variable path — as `theme.test.ts` does, and
 * for a reason that is not style.
 *
 * **Vite rewrites `new URL('./thing.css', import.meta.url)` into an asset URL**
 * when the string is a literal, so `fileURLToPath` then receives
 * `http://localhost/...` and throws *"The URL must be of scheme file"*. A
 * parameter cannot be analysed statically, so the URL stays a file one.
 */
const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const THEME = read('../theme.css');

/**
 * One palette's value for a token, out of the stylesheet.
 *
 * The light palette lives in `@theme static` and the dark one in `.dark`, which
 * is `theme.test.ts`'s finding — and the reason `.dark` is searched with its
 * brace is the one that file records: `.dark` alone also matches the
 * `@custom-variant` line, and the block found from there is the light palette.
 */
function tokenValue(block: '@theme static {' | '.dark {', name: string): string {
  const start = THEME.indexOf(block);
  const body = THEME.slice(start);
  const match = new RegExp(`--color-${name}\\s*:\\s*([^;]+);`).exec(body);
  if (match === null) throw new Error(`no --color-${name} after ${block}`);
  return (match[1] as string).trim();
}

describe('H.6 — an identifier is drawn by one map and no other', () => {
  /*
   * **The catalogue is not imported here, and that is the graph's decision.**
   *
   * `packages/ui` depends on no `@wikifake` package: the design system is the
   * one thing every application can use without pulling the game in, and adding
   * `@wikifake/domain` to it would make a button's package depend on the scoring
   * rules. So this file holds the maps to *each other*, and the test that every
   * catalogue identifier has an appearance lives in `apps/web`, which is where
   * the two already meet.
   */
  it('draws each identifier from exactly one map', () => {
    const maps = [MARKER_COLOURS, MARK_STYLES, FRAMES];
    const seen = maps.flatMap((map) => Object.keys(map));

    expect(new Set(seen).size, 'an identifier appears in two maps').toBe(seen.length);
  });

  it('has something for every identifier it names', () => {
    for (const [id, value] of Object.entries({
      ...MARKER_COLOURS,
      ...MARK_STYLES,
      ...FRAMES,
    })) {
      expect(value, `${id} maps to nothing`).not.toBe('');
    }
  });
});

describe('H.6 — a bought colour is visible on both grounds', () => {
  // WCAG 1.4.11, and the reason it is the right rule: what a marker colours is
  // the bar under a paragraph — `aria-hidden`, no children, a rectangle. AA text
  // contrast would be the wrong test, and would rule out every colour that is
  // worth buying.
  const grounds = DECORATION_GROUNDS.flatMap((token) => [
    [`light ${token}`, tokenValue('@theme static {', token)] as const,
    [`dark ${token}`, tokenValue('.dark {', token)] as const,
  ]);

  it.each(Object.entries(MARKER_COLOURS))('%s clears 3:1 everywhere', (id, hex) => {
    const colour = parseColour(hex);
    expect(colour, `${id} is not a colour`).not.toBeNull();

    for (const [where, value] of grounds) {
      const ground = parseColour(value);
      expect(ground, `${where} is not a colour`).not.toBeNull();

      const ratio = contrastRatio(colour!, ground!);
      expect(
        ratio,
        `${id} on ${where} is ${ratio.toFixed(2)}:1, under ${String(NON_TEXT_CONTRAST)}`,
      ).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
      expect(isVisibleDecoration(contrastRatio, colour!, ground!)).toBe(true);
    }
  });

  it('is measuring against the real stylesheet, not a copy of it', () => {
    // If `theme.css` stops declaring these, the loop above would be asserting
    // over an empty list and passing. `tokenValue` throws instead, and this is
    // the case that says so out loud.
    expect(grounds).toHaveLength(DECORATION_GROUNDS.length * 2);
    expect(() => tokenValue('@theme static {', 'not-a-token')).toThrow();
  });

  it('does not change colour when the page does, and no two are the same', () => {
    // A bought colour that inverted with the theme would be two cosmetics
    // wearing one name — `THEME_INDEPENDENT`'s argument about fills. One value
    // each, and four distinct ones.
    const values = Object.values(MARKER_COLOURS);
    expect(new Set(values).size).toBe(values.length);
  });

  it('is told apart by hue, which the 3:1-on-both rule forces', () => {
    /*
     * Not a nicety — the finding that decided the palette, kept as a test so
     * that the next colour added has to satisfy it too.
     *
     * A single hex clearing 3:1 against a near-white ground *and* a near-black
     * one has to sit in a narrow band of luminance, so every colour that passes
     * lands at nearly the same lightness. Asserting it here means a fifth
     * marker cannot quietly be added as a pale pink that fails on the dark page.
     */
    const values = Object.values(MARKER_COLOURS).map((hex) => parseColour(hex)!);

    for (const one of values) {
      for (const other of values) {
        // Within a fifth of a stop of each other: close enough that no pair is
        // distinguished by lightness, which is why the test above is the one
        // that matters.
        expect(contrastRatio(one, other)).toBeLessThan(1.2);
      }
    }
  });
});

describe('H.6 — reading a worn value at the screen', () => {
  it('falls back to the default for null and for a retired identifier', () => {
    // `cosmeticById`'s rule arriving at the screen: a retirement must draw the
    // default rather than nothing at all.
    expect(markerColourFor(null)).toBeNull();
    expect(markerColourFor('MARKER_TURQUOISE')).toBeNull();
    expect(markStyleFor(null)).toBe(markStyleFor('MARK_STYLE_UNDERLINE'));
    expect(markStyleFor('MARK_STYLE_SPIRAL')).toBe(markStyleFor(null));
    expect(frameFor(null)).toBe('');
    expect(frameFor('FRAME_GILDED')).toBe('');
  });

  it('hands back what was asked for when it exists', () => {
    expect(markerColourFor('MARKER_CRIMSON')).toBe(MARKER_COLOURS['MARKER_CRIMSON']);
    expect(markStyleFor('MARK_STYLE_BRACKET')).toBe(MARK_STYLES['MARK_STYLE_BRACKET']);
    expect(frameFor('FRAME_NOTCHED')).toBe(FRAMES['FRAME_NOTCHED']);
  });

  it('never colours anything that carries text', () => {
    // The rule, as far as a string can be held to it: a decoration class may
    // position, size and border a box, and may not set a text colour or a
    // background the token's prose sits on. `bg-transparent` is allowed —
    // it removes a fill rather than adding one.
    for (const classes of [...Object.values(MARK_STYLES), ...Object.values(FRAMES)]) {
      expect(classes).not.toMatch(/\btext-(?!\[)/);
      expect(classes).not.toMatch(/\bbg-(?!transparent\b)/);
    }
  });
});

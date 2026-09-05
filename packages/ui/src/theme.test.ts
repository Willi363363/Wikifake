// The theme, and what has to stay true of it.
//
// Two claims, each of which a careful reading could get wrong and a test cannot:
//
//  1. the dark palette answers for exactly the same colours as the light one —
//     no more, so a token nobody translated cannot fall back to its light value
//     on a dark background, and no fewer, so a dark-only colour cannot appear
//     from nowhere;
//  2. the gallery's list is the theme's list, so "every token is shown" holds
//     without anybody checking.
//
// There was a third, and step 10.9 retired it: every token of
// `frontend/src/styles/tokens.css` reaching the theme with the same value. That
// was the assertion that made "the theme is a transcription, not a redesign" a
// fact rather than a claim, and it held for as long as both existed. The legacy
// stylesheet is gone, so the transcription is now history and the theme is the
// palette — which is why the gallery list below is the one that has to be
// exact.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  COLOUR_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  THEME_INDEPENDENT,
} from './tokens.js';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const THEME = read('./theme.css');

/** Every `--name: value` declaration inside one brace-delimited block. */
function declarationsIn(css: string, opener: string): Map<string, string> {
  const start = css.indexOf(opener);
  if (start < 0) throw new Error(`no ${opener} block in the stylesheet`);

  // Balanced to the matching brace, so a nested block does not end the search
  // early and the rest of the file is not read as part of it.
  let depth = 0;
  let end = start;
  for (let at = css.indexOf('{', start); at < css.length; at += 1) {
    if (css[at] === '{') depth += 1;
    if (css[at] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = at;
        break;
      }
    }
  }

  const body = css.slice(css.indexOf('{', start) + 1, end);
  const found = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found.set(match[1] as string, (match[2] as string).trim());
  }
  return found;
}

// The opening brace is part of what is searched for: `.dark` on its own also
// matches the `@custom-variant` line that declares what dark *means*, and the
// block found from there is the theme's — which would make every dark assertion
// below compare the light palette with itself and pass.
const theme = declarationsIn(THEME, '@theme static {');
const dark = declarationsIn(THEME, '.dark {');

/** `rgba(24, 24, 27, 0.10)` and `rgba(24,24,27,.1)` are the same colour. */
const comparable = (value: string): string =>
  value
    .replaceAll(/\s+/g, '')
    .replaceAll(/0(\.\d+)/g, '$1')
    .replaceAll(/(\.\d*?)0+\b/g, '$1')
    .toLowerCase();

describe('6.1 — the tokens', () => {
  // If this one fails with "no @theme static { block", `static` has been
  // dropped: Tailwind then emits only the variables it can see a utility using,
  // and every colour read through `var(--color-…)` disappears from the build.
  // Eight of twenty-two survived the first time.
  it('declares its tokens statically, so a build drops none of them', () => {
    expect(THEME).toContain('@theme static {');
  });

  it('reads a token block out of the stylesheet', () => {
    expect(theme.size).toBeGreaterThan(0);
    expect(dark.size).toBeGreaterThan(0);
  });

  describe('the dark palette', () => {
    const colours = [...theme.keys()].filter((name) => name.startsWith('--color-'));

    it('answers for every colour the light one does', () => {
      expect(
        [...dark.keys()].filter((name) => name.startsWith('--color-')).sort(),
      ).toEqual([...colours].sort());
    });

    /*
     * This assertion used to read: *answers differently — a token repeated is a
     * token forgotten*, with no exceptions. The brutalist direction broke it on
     * purpose, and the fix is to state the new rule rather than to drop the old
     * check.
     *
     * A fill is the same colour on either ground — a yellow button is that
     * yellow on a dark page — and `on-fill` is black on either ground because
     * what it sits on is. Everything else still has to move, so the protection
     * the original assertion bought is intact: a ground or a wash nobody
     * translated fails here exactly as it did before.
     */
    const independent = THEME_INDEPENDENT.map((name) => `--color-${name}`);

    it('repeats the theme-independent tokens, and only those', () => {
      const unchanged = colours.filter(
        (name) => comparable(dark.get(name) ?? '') === comparable(theme.get(name) ?? ''),
      );
      expect(unchanged.sort()).toEqual([...independent].sort());
    });

    // The other half of it: a fill that drifted between the palettes would pass
    // the assertion above by simply not being in `unchanged`, and the failure
    // would be a button that changes colour with the theme for no reason.
    it('holds each of them to the same value in both palettes', () => {
      for (const name of independent) {
        expect(comparable(dark.get(name) ?? '')).toBe(comparable(theme.get(name) ?? ''));
      }
    });

    // The elevations too: the light shadows are a haze that vanishes on a dark
    // ground, where depth has to come from something darker than the surface.
    it('restates the elevations', () => {
      for (const level of SHADOW_TOKENS) {
        expect(dark.has(`--shadow-${level}`)).toBe(true);
      }
    });

    // The corners are geometry, not light: they are the same in both.
    it('leaves the corners alone', () => {
      for (const size of RADIUS_TOKENS) {
        expect(dark.has(`--radius-${size}`)).toBe(false);
      }
    });
  });

  // The gallery renders this list, so the list being the theme's list is what
  // makes "every token is shown" true without anybody counting.
  describe('the list the gallery renders', () => {
    it('names every colour of the theme, and only those', () => {
      expect(COLOUR_TOKENS.map((token) => `--color-${token.name}`).sort()).toEqual(
        [...theme.keys()].filter((name) => name.startsWith('--color-')).sort(),
      );
    });

    it('names every elevation and every corner', () => {
      expect(SHADOW_TOKENS.map((level) => `--shadow-${level}`).sort()).toEqual(
        [...theme.keys()].filter((name) => name.startsWith('--shadow-')).sort(),
      );
      expect(RADIUS_TOKENS.map((size) => `--radius-${size}`).sort()).toEqual(
        [...theme.keys()].filter((name) => name.startsWith('--radius-')).sort(),
      );
    });

    // The breakpoints and the floor are neither colour nor corner, so nothing
    // above covers them. They are what step 6.5 rests on: a length larger than
    // the floor with no breakpoint in front of it is a page that scrolls
    // sideways on a phone.
    it('names the breakpoints and the viewport floor', () => {
      expect(
        [...theme.keys()].filter((name) => name.startsWith('--breakpoint-')),
      ).toEqual([
        '--breakpoint-sm',
        '--breakpoint-md',
        '--breakpoint-lg',
        '--breakpoint-xl',
      ]);
      expect(theme.get('--width-floor')).toBe('360px');
    });

    it('gives every colour a role to show beside it', () => {
      for (const token of COLOUR_TOKENS) {
        expect(token.role.length).toBeGreaterThan(0);
      }
    });
  });
});

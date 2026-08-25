// The theme is a transcription, and this is what makes that a fact.
//
// Three claims, each of which a careful reading could get wrong and a test
// cannot:
//
//  1. every token of `tokens.css` reaches the theme, under a name Tailwind
//     understands, **with the same value**;
//  2. the dark palette answers for exactly the same colours — no more, so a
//     token nobody translated cannot fall back to its light value on a dark
//     background, and no fewer, so a dark-only colour cannot appear from
//     nowhere;
//  3. the gallery's list is the theme's list, so "every token is shown" holds
//     without anybody checking.
//
// It reads `frontend/src/styles/tokens.css`, which is the legacy frontend and is
// deleted at the cutover of phase 10 — the same arrangement as
// `scale-parity.test.ts`, and for the same reason: while the two exist, they
// must agree.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { COLOUR_TOKENS, RADIUS_TOKENS, SHADOW_TOKENS } from './tokens.js';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const LEGACY = read('../../../frontend/src/styles/tokens.css');
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

const legacy = declarationsIn(LEGACY, ':root');
// The opening brace is part of what is searched for: `.dark` on its own also
// matches the `@custom-variant` line that declares what dark *means*, and the
// block found from there is the theme's — which would make every dark assertion
// below compare the light palette with itself and pass.
const theme = declarationsIn(THEME, '@theme static {');
const dark = declarationsIn(THEME, '.dark {');

/**
 * Where a legacy token lands in the theme.
 *
 * Three namespaces, because Tailwind builds its utilities from them: a colour
 * under `--color-` becomes `bg-…`, `text-…` and `border-…`; `--radius-` becomes
 * `rounded-…`; `--shadow-` becomes `shadow-…`. A token filed under the wrong one
 * is a token with no utility, which is the failure this naming exists to
 * prevent.
 */
function themeNameFor(legacyName: string): string {
  if (legacyName.startsWith('--shadow-')) return legacyName;
  if (legacyName.startsWith('--r-')) return `--radius-${legacyName.slice('--r-'.length)}`;
  return `--color-${legacyName.slice('--'.length)}`;
}

/** `rgba(24, 24, 27, 0.10)` and `rgba(24,24,27,.1)` are the same colour. */
const comparable = (value: string): string =>
  value
    .replaceAll(/\s+/g, '')
    .replaceAll(/0(\.\d+)/g, '$1')
    .replaceAll(/(\.\d*?)0+\b/g, '$1')
    .toLowerCase();

describe('6.1 — the tokens, transcribed', () => {
  // If this one fails with "no @theme static { block", `static` has been
  // dropped: Tailwind then emits only the variables it can see a utility using,
  // and every colour read through `var(--color-…)` disappears from the build.
  // Eight of twenty-two survived the first time.
  it('declares its tokens statically, so a build drops none of them', () => {
    expect(THEME).toContain('@theme static {');
  });

  it('reads a token block out of each stylesheet', () => {
    expect(legacy.size).toBeGreaterThan(0);
    expect(theme.size).toBeGreaterThan(0);
    expect(dark.size).toBeGreaterThan(0);
  });

  // The criterion: every token of `tokens.css` has its named equivalent.
  it.each([...legacy.keys()])('carries %s over', (name) => {
    const expected = legacy.get(name) as string;
    const under = themeNameFor(name);

    expect(theme.has(under)).toBe(true);
    expect(comparable(theme.get(under) as string)).toBe(comparable(expected));
  });

  // And nothing appeared along the way. A colour the theme invented is a colour
  // no screen of the current game uses, which is the redesign this phase is
  // written not to do.
  it('invents no colour of its own', () => {
    const carried = new Set([...legacy.keys()].map(themeNameFor));
    const extra = [...theme.keys()].filter((name) => !carried.has(name));
    expect(extra).toEqual([]);
  });

  describe('the dark palette', () => {
    const colours = [...theme.keys()].filter((name) => name.startsWith('--color-'));

    it('answers for every colour the light one does', () => {
      expect(
        [...dark.keys()].filter((name) => name.startsWith('--color-')).sort(),
      ).toEqual([...colours].sort());
    });

    it('answers differently — a token repeated is a token forgotten', () => {
      const unchanged = colours.filter(
        (name) => comparable(dark.get(name) ?? '') === comparable(theme.get(name) ?? ''),
      );
      expect(unchanged).toEqual([]);
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

    it('gives every colour a role to show beside it', () => {
      for (const token of COLOUR_TOKENS) {
        expect(token.role.length).toBeGreaterThan(0);
      }
    });
  });
});

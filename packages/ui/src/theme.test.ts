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
// L.9 — the same palette again, for a machine set to dark by a reader who has
// chosen nothing. Found by its selector rather than by the media query, so the
// two blocks are told apart by what they match and not by where they sit.
const system = declarationsIn(THEME, ':root:not(.light):not(.dark) {');

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
     * This assertion originally read: *answers differently — a token repeated is
     * a token forgotten*, with no exceptions. Track A's fills broke it on
     * purpose — a yellow button is that yellow on a dark page — and the list
     * named the ones allowed to repeat.
     *
     * L.3 emptied the list, so the original rule is back in full: **no colour
     * may be the same in both palettes.** J2's accent is a blue, and a blue that
     * did not move would measure 2.95 on a dark card. The assertion is left
     * expressed in terms of the list rather than rewritten, because the list is
     * what a future direction would reopen, and the reasoning belongs beside it
     * in `tokens.ts`.
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

    /*
     * This required the dark palette to have **no** elevation of its own, and
     * it was right for track A: a solid block of `--color-line-strong` at an
     * offset inverts because that token does, so restating it would have been
     * one line saying the same thing twice.
     *
     * L.6 replaced those with light. Light does not invert through a border
     * colour — the near-black haze that separates a white card from a grey page
     * is nothing at all on #0b0f17 — so the rule turns over: every elevation is
     * restated, and restated *differently*. This is phase 6's original
     * requirement coming back with the shadows that needed it.
     */
    it('restates every elevation, and none of them the same twice', () => {
      for (const level of SHADOW_TOKENS) {
        const light = theme.get(`--shadow-${level}`);
        const night = dark.get(`--shadow-${level}`);
        expect(light, `--shadow-${level} is missing from the theme`).toBeDefined();
        expect(night, `--shadow-${level} is missing from the dark palette`).toBeDefined();
        expect(comparable(night ?? '')).not.toBe(comparable(light ?? ''));
      }
    });

    /*
     * The mirror of the rule it replaces.
     *
     * Track A asserted `/^\d+px \d+px 0 /` — a hard offset, no blur — because a
     * blurred shadow was the thing that direction did not do. J2 does not do
     * the frame at an offset, and a hard shadow is exactly how one comes back:
     * it is the only elevation that reads as an edge rather than as light.
     *
     * So both halves are checked, in both palettes: a blur radius that is not
     * zero, and no `0` in the position a hard offset puts it.
     */
    it('blurs every elevation, in both palettes', () => {
      // A length CSS accepts in an offset: `0` is unitless, the rest carry px.
      const OFFSET = String.raw`(?:0|-?\d+px)`;
      const BLURRED = new RegExp(`${OFFSET}\\s+${OFFSET}\\s+[1-9]\\d*px`);

      for (const level of SHADOW_TOKENS) {
        for (const [palette, declared] of [
          ['light', theme.get(`--shadow-${level}`) ?? ''],
          ['dark', dark.get(`--shadow-${level}`) ?? ''],
        ] as const) {
          // Every layer of it, not only the first: a two-layer shadow whose
          // second layer is a hard offset is a frame with a glow in front of it.
          for (const layer of declared.split(/,(?![^(]*\))/)) {
            expect(layer.trim(), `--shadow-${level} in ${palette}`).toMatch(BLURRED);
          }
        }
      }
    });

    /*
     * L.9 — the copy, and why a copy is allowed to exist.
     *
     * `.dark` is a choice and the media query is the absence of one, and CSS
     * has no way to apply one rule's body under a condition another rule is not
     * under. So the declarations are written twice, and this is what makes that
     * safe: a token added to one and forgotten in the other fails here rather
     * than shipping a palette that is dark down one path and half-dark down the
     * other.
     *
     * Name for name and value for value. `comparable` is what lets a reformat
     * of one of them not count as a difference.
     */
    it('repeats itself exactly for a machine whose reader chose nothing', () => {
      expect([...system.keys()].sort()).toEqual([...dark.keys()].sort());

      for (const [name, value] of dark) {
        expect(comparable(system.get(name) ?? ''), name).toBe(comparable(value));
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
    /*
     * The families, and the fallback that is doing real work.
     *
     * An undefined custom property invalidates the whole declaration at
     * computed-value time — so `var(--font-archivo), sans-serif` resolves to
     * nothing at all, not to `sans-serif`, anywhere the application has not
     * loaded the face. The gallery in isolation and every jsdom test are
     * exactly that, and the failure would be silent.
     *
     * So each `var()` carries its own fallback, and this says so out loud.
     */
    it('names a family for prose and one for code, each with a fallback', () => {
      for (const role of ['sans', 'mono']) {
        const stack = theme.get(`--font-${role}`) ?? '';
        expect(stack).toMatch(/var\(--font-[\w-]+,\s*ui-(?:sans-serif|monospace)\)/);
        expect(stack).toMatch(/(?:sans-serif|monospace)\s*$/);
      }
    });

    /*
     * There was an assertion here: *names the structural border width*, holding
     * `--border-width-3` to 3px. It was the width track A framed everything at,
     * and every primitive read it.
     *
     * L.6 took it off the game's screens and L.7 off the admin panel, which left
     * a token with no reader. It is gone rather than kept as a spelling nobody
     * uses, and this is what stands in its place: **no width token at all.** A
     * direction that separates by surface has one border width, and it is
     * Tailwind's own hairline — a second one declared here would be the first
     * step back towards a frame.
     */
    it('declares no border width of its own', () => {
      expect(
        [...theme.keys()].filter((name) => name.startsWith('--border-width-')),
      ).toEqual([]);
    });

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

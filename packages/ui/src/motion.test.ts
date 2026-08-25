// The keyframes, and the preference.
//
// Two claims. The first is bookkeeping: every keyframe the legacy stylesheet
// defines and something actually uses is named in the theme, and the theme
// invents none. The second is the one that matters — every animation that
// flashes or displaces the page is switched off under
// `prefers-reduced-motion: reduce`, and it is switched off by name.
//
// A blanket `animation: none !important` would satisfy a reading of the
// criterion and satisfy nothing else: it also kills the fades, and it still
// misses an inline `animation:` written as a string — which is how the current
// game applies all eighteen of these.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { MOTIONS, REDUCIBLE } from './motion.js';

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const LEGACY = `${read('../../../frontend/src/styles/animations.css')}\n${read(
  '../../../frontend/src/styles/effects.css',
)}`;
const MOTION = read('./motion.css');

const keyframesIn = (css: string): string[] =>
  [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)].map((match) => match[1] as string);

/** The `--animate-*` names declared inside a block, in order. */
function animationsIn(css: string, opener: string): string[] {
  const start = css.indexOf(opener);
  if (start < 0) throw new Error(`no ${opener} block`);

  let depth = 0;
  let end = css.length;
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
  return [...body.matchAll(/--animate-([\w-]+)\s*:/g)].map((match) => match[1] as string);
}

/**
 * The two keyframes the legacy stylesheet defines and nothing references.
 *
 * Verified by searching the whole of `frontend/src` for either name outside the
 * stylesheet that declares them: neither appears. A transcription is not the
 * place to carry dead CSS across, and naming them here is what stops the next
 * reader wondering whether they were forgotten.
 */
const DEAD = ['ring-progress', 'drift'];

describe('6.3 — the keyframes, and the preference', () => {
  const declared = keyframesIn(LEGACY);
  const ported = keyframesIn(MOTION);
  const named = animationsIn(MOTION, '@theme static {');

  it('finds the legacy keyframes to compare against', () => {
    expect(declared.length).toBeGreaterThan(10);
  });

  // The criterion: every ported keyframe is named in the theme.
  it.each(MOTIONS.map((motion) => motion.name))('names %s in the theme', (name) => {
    expect(named).toContain(name);
    expect(ported).toContain(name);
  });

  it('ports every keyframe that something uses, and only those', () => {
    expect([...ported].sort()).toEqual(
      declared.filter((name) => !DEAD.includes(name)).sort(),
    );
  });

  it('leaves the dead ones behind', () => {
    for (const name of DEAD) {
      expect(declared).toContain(name);
      expect(ported).not.toContain(name);
    }
  });

  it('gives every animation a name and a role in the list', () => {
    expect(named.sort()).toEqual(MOTIONS.map((motion) => motion.name).sort());
    for (const motion of MOTIONS) expect(motion.role.length).toBeGreaterThan(0);
  });

  describe('prefers-reduced-motion', () => {
    const reduced = animationsIn(MOTION, '@media (prefers-reduced-motion: reduce) {');

    // The criterion, and the reason it is not a comfort setting: the strobes run
    // at about 4.4 flashes a second and the displacements at seven and ten.
    it('switches off every flash and every displacement', () => {
      expect([...reduced].sort()).toEqual([...REDUCIBLE].sort());
    });

    it('switches them off by name, to none', () => {
      for (const name of REDUCIBLE) {
        expect(MOTION).toMatch(
          new RegExp(`--animate-${name}\\s*:\\s*none`.replaceAll('-', '\\-')),
        );
      }
    });

    // A fade is not motion. Removing every one of them makes state changes snap
    // rather than settle, which helps nobody and is not what the preference asks
    // for.
    it('leaves the fades alone', () => {
      const kept = MOTIONS.filter((motion) => !motion.reducible);
      expect(kept.length).toBeGreaterThan(0);
      for (const motion of kept) expect(reduced).not.toContain(motion.name);
    });

    // The classification is the whole argument, so it is checked rather than
    // trusted: anything that flashes or displaces is reducible, and nothing else
    // is.
    it('reduces exactly what flashes or displaces', () => {
      for (const motion of MOTIONS) {
        const dangerous = motion.kind === 'flash' || motion.kind === 'displace';
        expect(motion.reducible).toBe(dangerous);
      }
    });

    it('has something to switch off in both categories', () => {
      const kinds = MOTIONS.filter((motion) => motion.reducible).map(
        (motion) => motion.kind,
      );
      expect(kinds).toContain('flash');
      expect(kinds).toContain('displace');
    });
  });
});

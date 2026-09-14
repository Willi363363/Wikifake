// Disabled is a style, and a scan that keeps it one.
//
// `disabled:opacity-40` was the one translucency in a direction that fades
// nothing, and it was recorded in `06-structural-debt.md` rather than fixed
// because it belongs to this package. Two things made it worth more than a
// tidy-up:
//
//   - **It was illegible in the place it mattered most.** On the primary button
//     it composited #ffe14d against the page and the black text with it, so a
//     `Submitted` in the round's top bar read as grey on cream.
//   - **Nothing could measure it.** `CONTRAST_PAIRS` measures two declared
//     tokens; an opacity composite is neither of them, and WCAG 1.4.3 exempts a
//     disabled control, so no audit called it either. It was invisible to every
//     check this repository has.
//
// The replacement is the direction's own vocabulary — a flat fill, a collapsed
// shadow, text a step down — and both colours are tokens, so the state is now a
// row of the audit (`muted` on `bg-grain`, 6.52 and 7.05).
//
// This file is what stops the fade coming back. It is a scan rather than a
// render: the defect is a class in the source, visible without a browser, and
// the next `disabled:opacity-` somebody types is caught in the diff that types
// it. It reads `apps/web` too, because four of the five uses were there — the
// primitive is where the rule lives, not where it is only obeyed.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SELF = fileURLToPath(import.meta.url);
const HERE = dirname(SELF);
const REPO = join(HERE, '..', '..', '..', '..');

/** The two trees that draw: the design system, and the app that uses it. */
const TREES = [join(REPO, 'packages', 'ui', 'src'), join(REPO, 'apps', 'web', 'src')];

function sourcesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesUnder(path);
    // This file states the rule, in a regular expression that is code rather
    // than comment. A rule is not a violation of itself.
    if (path === SELF) return [];
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

/**
 * The file with its comments removed.
 *
 * Without this the scan finds its own prose: this file names the class it
 * forbids, and so do the comments that replaced it. A rule that cannot be
 * explained in the file it governs is a rule somebody deletes for being
 * inexplicable.
 */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('the disabled state is a style, not a translucency', () => {
  const files = TREES.flatMap(sourcesUnder);

  it('found both trees', () => {
    // A scan of nothing passes, which is the failure mode of every scan.
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((path) => path.includes(join('packages', 'ui')))).toBe(true);
    expect(files.some((path) => path.includes(join('apps', 'web')))).toBe(true);
  });

  it('never fades a disabled control', () => {
    const fading = files
      .filter((path) =>
        /(?:peer-)?disabled:opacity-/.test(code(readFileSync(path, 'utf8'))),
      )
      .map((path) => path.slice(REPO.length + 1))
      .sort();

    expect(fading).toEqual([]);
  });
});

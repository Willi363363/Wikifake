// The scene's stylesheets, held to the four things a render cannot see.
//
// Steps C.3 and C.4 split the scene across `app/landing-*.css`: the stage is one
// mechanism, the collision is one use of it, and neither fits in a file anybody
// rereads. Splitting it bought two new ways to be wrong, and both are silent:
//
// - a class name is a string, and a mistyped one styles nothing and says
//   nothing;
// - the media query that is the scene's switch is now written once per file,
//   and CSS has no way to share a condition.
//
// Neither shows up as a failing render. A rule written outside that query is
// worse still: it applies on a phone and to a viewer who asked for less motion,
// which is non-negotiable 2 undone by a brace in the wrong place.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { BEAT_FADE_EDGE } from './stage-progress.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', 'app');

/** Every stylesheet the scene is spread across, by name. */
const SHEETS = readdirSync(APP)
  .filter((name) => name.startsWith('landing-') && name.endsWith('.css'))
  .map((name) => ({ name, text: readFileSync(join(APP, name), 'utf8') }));

const SCENE = SHEETS.map(({ text }) => text).join('\n');

/** The one condition every scene rule sits behind. */
const SWITCH = '@media (min-width: 48rem) and (prefers-reduced-motion: no-preference)';

/**
 * Every `landing-` class the components actually write.
 *
 * Read out of `className` strings rather than out of the file, because the same
 * prefix names the headings' `id` attributes — `landing-question` is an anchor,
 * not a rule, and a scan that cannot tell them apart demands a stylesheet entry
 * for every heading on the page.
 */
const USED = new Set(
  readdirSync(HERE)
    .filter((name) => name.endsWith('.tsx') && !name.includes('.test.'))
    .flatMap((name) => [
      ...readFileSync(join(HERE, name), 'utf8').matchAll(/className=["'{]([^"'}]*)/g),
    ])
    .flatMap(([, classes]) => (classes ?? '').split(/\s+/))
    .filter((name) => name.startsWith('landing-')),
);

describe('every class the markup writes is a class the scene defines', () => {
  it('found some to check', () => {
    expect(USED.size).toBeGreaterThan(6);
  });

  it.each([...USED])('%s has a rule', (name) => {
    // A mistyped class is a silent no-op: the element renders, it simply never
    // moves, and no render test can tell that from a beat that chose not to.
    expect(SCENE).toContain(`.${name}`);
  });
});

describe('nothing moves outside the media query', () => {
  it('found the stylesheets', () => {
    expect(SHEETS.length).toBeGreaterThan(1);
  });

  it.each(SHEETS.map(({ name }) => name))(
    '%s puts every rule behind the switch',
    (name) => {
      const sheet = SHEETS.find((candidate) => candidate.name === name)?.text ?? '';
      const at = sheet.indexOf(SWITCH);
      expect(at).toBeGreaterThan(-1);

      // What may live outside it is spacing between sections. A transform, an
      // opacity, a grid or a sticky position out there is the reduced-motion path
      // undone — and it would still pass every test that renders a component.
      const before = sheet.slice(0, at);
      for (const forbidden of ['transform:', 'opacity:', 'position:', 'display: grid']) {
        expect(before).not.toContain(forbidden);
      }
    },
  );

  // Guards the guard: a scan whose forbidden list matched nothing anywhere would
  // pass on a stylesheet doing all four.
  it('would notice, if there were something to notice', () => {
    for (const forbidden of ['transform:', 'opacity:', 'position:', 'display: grid']) {
      expect(SCENE).toContain(forbidden);
    }
  });
});

describe('the switch is written once, in every file that repeats it', () => {
  it('matches the theme’s own md breakpoint', () => {
    // A media query cannot read a custom property, so the width is a copy of
    // `--breakpoint-md`. This is what stops the copy from drifting: move the
    // breakpoint and this fails, in the same run.
    const theme = readFileSync(
      join(HERE, '..', '..', '..', '..', 'packages', 'ui', 'src', 'theme.css'),
      'utf8',
    );
    const md = /--breakpoint-md:\s*([^;]+);/.exec(theme)?.[1]?.trim();

    expect(SWITCH).toContain(`min-width: ${String(md)}`);
  });

  it.each(SHEETS.map(({ name }) => name))('%s uses the identical query', (name) => {
    // CSS has no way to hand one condition to two files, so it is repeated —
    // and a repeated condition is one that drifts unless something reads both.
    expect(SHEETS.find((candidate) => candidate.name === name)?.text).toContain(SWITCH);
  });
});

describe('the stylesheet stops drawing a beat where the driver stops counting it', () => {
  it('fades out at BEAT_FADE_EDGE', () => {
    // The stylesheet decides when a beat is invisible; the driver decides when
    // it stops taking focus. Those have to be the same moment, and a media
    // query cannot import a constant.
    expect(SCENE).toContain(`+ ${String(BEAT_FADE_EDGE)}) / 0.25`);
    expect(SCENE).toContain(
      `(${String(BEAT_FADE_EDGE)} - var(--beat-progress, 0)) / 0.25`,
    );
  });
});

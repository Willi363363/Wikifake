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
//
// Step C.6 added a third, and it is the one that had already happened: a rule
// inside the query that the `<noscript>` revert does not know about. There the
// media query is *on* — a wide viewport, no stated preference — and the only
// thing between the visitor and four stacked screens that never advance is a
// block of `!important` in `stage.tsx`. It reverted three declarations and left
// thirteen elements at `opacity: 0`.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { WITHOUT_SCRIPT } from './stage.js';
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

/**
 * Every innermost rule of the scene, as a selector and a body.
 *
 * Innermost because the body pattern refuses a brace: an `@media` block's
 * content has rules in it, so it can never match, and what comes back is the
 * rules themselves — with the media prelude falling away as the selector's
 * leading whitespace. Comments are stripped first, or one containing a brace
 * would end a rule early.
 */
const RULES = [
  ...SCENE.replace(/\/\*[\s\S]*?\*\//g, ' ').matchAll(
    /([.#:a-zA-Z][^{}]*?)\s*\{([^{}]+)\}/g,
  ),
].map(([, selector, body]) => ({ selector: (selector ?? '').trim(), body: body ?? '' }));

describe('a browser with no script is handed the document back', () => {
  it('found the rules to check', () => {
    expect(RULES.length).toBeGreaterThan(8);
  });

  /*
   * The layout half, and the half that has to be enumerated.
   *
   * What is refused is a rule that takes an element *out* of the flow, or
   * replaces the flow inside it — the camera, the stacked beats, the article's
   * three-row grid. Each of those, unreverted, is a page a script-less browser
   * cannot read, and `.landing-article` was one: beats 2 and 3 kept a 9rem
   * header row under a heading that no longer fitted in one.
   *
   * Two exclusions, and both are about what the flow contains. `position:
   * relative` leaves an element exactly where the flow put it — `.landing-mark`
   * needs it, and reverting it would move nothing and break the wipe. And a
   * **pseudo-element** has no place in the document to be taken out of: it is
   * generated by the rule that positions it, so `.landing-mark::before` is
   * decoration inside a box rather than layout of one.
   */
  const LAYOUT = /position:\s*(?:absolute|sticky|fixed)|display:\s*(?:grid|flex)/;

  const laidOut = RULES.filter(
    ({ selector, body }) => LAYOUT.test(body) && !selector.includes('::'),
  );

  it('found some layout to revert', () => {
    expect(laidOut.length).toBeGreaterThan(2);
  });

  it.each(laidOut.map(({ selector }) => selector))('reverts %s', (selector) => {
    expect(WITHOUT_SCRIPT).toContain(selector);
  });

  /*
   * The other half, and the reason the block is five lines rather than fifteen.
   *
   * Every ramp in the scene is a `clamp()` around `--beat-progress`, and every
   * one resolves to its finished value at zero. Pinning the variable neutralises
   * the ones this test can see and the ones a later beat adds, which is what an
   * enumeration could not have done.
   */
  it('pins the variable every ramp is computed from', () => {
    expect(SCENE).toContain('var(--beat-progress');
    expect(WITHOUT_SCRIPT).toContain('--beat-progress: 0 !important');
  });

  // Guards the guard. A rule parser that matched nothing would pass every
  // assertion above on a stylesheet that reverted none of it.
  it('would notice, if there were something to notice', () => {
    const invented = RULES.map(({ selector }) => selector);
    expect(invented).toContain('.landing-stage__camera');
    expect(LAYOUT.test('position: absolute;')).toBe(true);
    expect(LAYOUT.test('position: relative;')).toBe(false);
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

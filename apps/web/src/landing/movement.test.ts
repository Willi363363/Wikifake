// Step C.3 — the movement vocabulary, held to two rules.
//
// A class name is a string, and a mistyped one styles nothing and says nothing.
// A rule written outside the scene's media query applies on a phone and to a
// viewer who asked for less motion, which is non-negotiable 2 undone by a brace
// in the wrong place. Neither shows up as a failing render, so neither is caught
// by a component test — both are caught here.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCENE = readFileSync(join(HERE, '..', '..', 'app', 'landing.css'), 'utf8');

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
      ...readFileSync(join(HERE, name), 'utf8').matchAll(/className="([^"]*)"/g),
    ])
    .flatMap(([, classes]) => (classes ?? '').split(/\s+/))
    .filter((name) => name.startsWith('landing-')),
);

/** The stylesheet, split at the media query that is the scene's switch. */
function halves(): { before: string; inside: string } {
  const at = SCENE.indexOf('@media (min-width:');
  expect(at).toBeGreaterThan(-1);
  return { before: SCENE.slice(0, at), inside: SCENE.slice(at) };
}

describe('C.3 — every class the markup writes is a class the scene defines', () => {
  it('found some to check', () => {
    expect(USED.size).toBeGreaterThan(4);
  });

  it.each([...USED])('%s has a rule', (name) => {
    // A mistyped class is a silent no-op: the element renders, it simply never
    // moves, and no render test can tell that from a beat that chose not to.
    expect(SCENE).toContain(`.${name}`);
  });
});

describe('C.3 — nothing moves outside the media query', () => {
  it('leaves the document mode with rhythm and nothing else', () => {
    const { before } = halves();

    // What may live out here is spacing between sections. A transform, an
    // opacity or a sticky position out here is the reduced-motion path
    // undone — and it would still pass every test that renders a component.
    expect(before).toContain('.landing-stage__beat + .landing-stage__beat');
    for (const forbidden of [
      'transform:',
      'opacity:',
      'position: sticky',
      'position: absolute',
    ]) {
      expect(before).not.toContain(forbidden);
    }
  });

  it('keeps the movement vocabulary inside it', () => {
    const { before, inside } = halves();

    expect(before).not.toContain('.landing-move');
    expect(inside).toContain('.landing-move');
  });

  // Guards the guard: a split that found nothing would pass both tests above.
  it('really did split the stylesheet', () => {
    const { before, inside } = halves();
    expect(before.length).toBeGreaterThan(100);
    expect(inside.length).toBeGreaterThan(100);
  });
});

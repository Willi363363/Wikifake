// The gallery is the phase deliverable, so "it shows everything" has to be a
// fact rather than a habit.
//
// The palette needs no test here: the page renders `@wikifake/ui`'s own lists,
// and `theme.test.ts` holds those to the stylesheet. The primitives are named
// one by one — a component is a call site, not a list entry — so this is what
// notices when one is exported and never shown.
//
// A source-level check, and it says so. Rendering the page here would mean a DOM
// and a React runtime in an application whose suite is otherwise about route
// handlers; what it would buy is the difference between "mentioned" and
// "rendered", and every mention below is a JSX tag.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PRIMITIVES } from '@wikifake/ui';
import { describe, expect, it } from 'vitest';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/**
 * The whole gallery, not just its page.
 *
 * It is several files now: the page lays the sections out, and the ones that
 * need a viewer to press something are their own client components. Reading
 * only `page.tsx` would report a component as missing the moment it moved into
 * a section of its own.
 */
const PAGE = readdirSync(HERE)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => readFileSync(HERE + name, 'utf8'))
  .join('\n');

describe('6.2 — the gallery', () => {
  it.each(PRIMITIVES)('shows %s', (primitive) => {
    expect(PAGE).toContain(`<${primitive}`);
  });

  // Both palettes, from the same markup. A component that hard-codes a colour
  // looks perfectly fine until it is put on the other ground.
  it('renders the primitives in both modes', () => {
    expect(PAGE.match(/<Primitives \/>/g)).toHaveLength(2);
    expect(PAGE).toContain('className="dark flex-1"');
  });

  it('renders the palette in both modes', () => {
    expect(PAGE.match(/<Palette \/>/g)).toHaveLength(2);
  });
});

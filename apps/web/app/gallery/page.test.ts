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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PRIMITIVES } from '@wikifake/ui';
import { describe, expect, it } from 'vitest';

const PAGE = readFileSync(fileURLToPath(new URL('./page.tsx', import.meta.url)), 'utf8');

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

// The rail and the routes are one list — step K.4.
//
// `sections.ts` has claimed since K.1 that "a section added here without a
// route is a link to a 404, and a route added without an entry here is a page
// nobody can reach — `sections.test.ts` holds both". The file did not exist.
// This is it, written when K.4 leaned on the promise: the page heading now
// reads the section off this list, so a route missing from it stopped being a
// dead rail entry and became a page with the wrong name in its `h1`.
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import adminEn from '../../messages/en/admin.json';
import { GROUPS, sectionAt, SECTIONS } from './sections.js';

const ROUTES = fileURLToPath(new URL('../../app/[locale]/admin/', import.meta.url));

/** Every address under `app/[locale]/admin` that renders a page. */
function routes(): string[] {
  const found = ['/admin'];
  for (const entry of readdirSync(ROUTES, { withFileTypes: true })) {
    if (entry.isDirectory()) found.push(`/admin/${entry.name}`);
  }
  return found.sort();
}

/** A dotted key, resolved against the English catalogue. */
function message(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (at, step) => (at as Record<string, unknown> | undefined)?.[step],
      adminEn,
    );
}

describe('K.1 — the rail and the routes are the same eight', () => {
  it('found the routes, so the rules below are not vacuous', () => {
    expect(routes().length).toBeGreaterThan(1);
  });

  it('gives every section a route that exists', () => {
    // A section with no page is a link to a 404 on the panel's own navigation,
    // which is the one 404 the gate is not supposed to be producing.
    expect(SECTIONS.map((section) => section.route).sort()).toEqual(routes());
  });

  it('gives every route an entry on the rail', () => {
    // The other direction, and the one a new page gets wrong: a route nobody
    // can reach from the rail is a page only its author knows about.
    for (const route of routes()) {
      expect(SECTIONS.some((section) => section.route === route)).toBe(true);
    }
  });

  it('names every section with a key the catalogue actually has', () => {
    // `AdminKey` makes this a compile error too; this is what catches a key
    // deleted from the JSON while the type still resolves through a stale
    // build.
    for (const section of SECTIONS) {
      expect(typeof message(section.key), section.key).toBe('string');
    }
  });

  it('names every group, and leaves Overview outside all of them', () => {
    // Overview is the page about all three groups, so filing it under one of
    // them would be a claim that is not true.
    const [first, ...rest] = GROUPS;

    expect(first?.key).toBeNull();
    expect(first?.sections.map((section) => section.route)).toEqual(['/admin']);
    for (const group of rest) {
      expect(typeof message(group.key as string), String(group.key)).toBe('string');
      expect(group.sections.length).toBeGreaterThan(0);
    }
  });
});

describe('K.1 — the section a path is on', () => {
  it('answers the longest match, not the first', () => {
    // `/admin` is a prefix of all seven others, so a naive `startsWith` would
    // answer Overview for every page in the panel — and K.3's heading would
    // say "Overview" on the cost page.
    expect(sectionAt('/admin')?.key).toBe('nav.overview');
    expect(sectionAt('/admin/cost')?.key).toBe('cost.title');
    expect(sectionAt('/admin/players')?.key).toBe('players.title');
  });

  it('answers nothing for a path that is not a section', () => {
    // The heading falls back to the panel's own name, and a fallback that
    // could be reached silently is a page named after the product.
    expect(sectionAt('/admin/nowhere')).toBeUndefined();
    expect(sectionAt('/quests')).toBeUndefined();
  });
});

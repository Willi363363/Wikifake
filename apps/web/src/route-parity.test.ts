// C8.1 — the REST catalogue equals the routes that exist.
//
// The successor to the half of `packages/protocol/src/rest/route-parity.test.ts`
// that read `backend/src/api/` decorators. That file died with the Python in
// step 10.9, and C8.2 is explicit about what happens if a guarantee is allowed
// to die with its subject: it disappears without a sound. So the same line is
// held from the other side — against the routes of `apps/web`, which is what the
// catalogue now describes.
//
// It lives here rather than in `@wikifake/protocol` because the subject moved. A
// package reading its consumer's source tree was tolerable while the consumer
// was Python and could not import anything; now the app owns the routes, and the
// app is where the assertion belongs.
//
// What it catches: a route handler added without an entry in the catalogue —
// which means no schema, no generated documentation, and a contract nobody
// validates — and an entry that describes a route nobody serves.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ROUTE_KEYS } from '@wikifake/protocol';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', 'app');

/**
 * Prefixes the catalogue deliberately does not describe.
 *
 * `/api/auth` is Better Auth's own contract — sign-in, sign-up, callbacks,
 * session and sign-out under one catch-all. Enumerating them in our catalogue
 * would be a list to keep in step with a library that owns it, and the
 * catch-all's own file says so.
 */
const NOT_OURS = ['/api/auth'] as const;

/** Every `route.ts` under `app/`, as the URL path Next serves it at. */
function routeFiles(): { path: string; source: string }[] {
  const found: { path: string; source: string }[] = [];

  const walk = (directory: string, urlPath: string): void => {
    for (const name of readdirSync(directory)) {
      if (name === 'node_modules' || name === '.next') continue;
      const child = join(directory, name);

      if (statSync(child).isDirectory()) {
        // A route group — `(game)` — is not part of the URL, which is the whole
        // reason for the parentheses.
        walk(child, name.startsWith('(') ? urlPath : `${urlPath}/${name}`);
        continue;
      }
      if (name !== 'route.ts') continue;
      found.push({
        path: urlPath === '' ? '/' : urlPath,
        source: readFileSync(child, 'utf8'),
      });
    }
  };

  walk(APP, '');
  return found;
}

/** `METHOD /path` for every handler a route file exports, sorted. */
function servedRoutes(): string[] {
  const found: string[] = [];
  for (const { path, source } of routeFiles()) {
    if (NOT_OURS.some((prefix) => path.startsWith(prefix))) continue;
    for (const match of source.matchAll(
      /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g,
    )) {
      found.push(`${match[1] as string} ${path}`);
    }
  }
  return found.sort();
}

describe('C8.1 — the REST catalogue equals the routes that exist', () => {
  // The way this test could pass while measuring nothing: a walk that finds no
  // file, or a regex that stops matching, turns both sides into empty lists.
  it('actually found the handlers', () => {
    expect(routeFiles().length).toBeGreaterThan(5);
    expect(servedRoutes().length).toBeGreaterThan(5);
  });

  it('covers every route served, and invents none', () => {
    expect(servedRoutes()).toEqual([...ROUTE_KEYS]);
  });

  it('serves nothing under a method the catalogue does not describe', () => {
    // Read the other way round, so a failure names the offender rather than
    // printing two long lists and leaving the diff to a reader.
    const described = new Set(ROUTE_KEYS);
    expect(servedRoutes().filter((route) => !described.has(route))).toEqual([]);
  });

  it('leaves the library its own prefix, and only that', () => {
    // A guard on the exemption itself: it must still match something, or it is
    // a hole somebody widened and nobody noticed.
    const exempt = routeFiles().filter(({ path }) =>
      NOT_OURS.some((prefix) => path.startsWith(prefix)),
    );
    expect(exempt.map(({ path }) => path)).toEqual(['/api/auth/[...all]']);
  });
});

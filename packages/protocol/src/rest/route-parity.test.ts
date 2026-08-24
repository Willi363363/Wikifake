// The other half of C8.1, held from the new stack: the catalogue equals the
// route decorators.
//
// Like `ws/dispatch-parity.test.ts`, this reads `backend/` and therefore dies
// with it in phase 10. That is deliberate — a guarantee that outlives its
// subject in silence is worse than no guarantee.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ROUTES, ROUTE_KEYS } from './routes.js';

const API = fileURLToPath(new URL('../../../../backend/src/api/', import.meta.url));

/** Every `@router.get("/x")` / `@router.post("/x")` under `backend/src/api/`. */
function decoratedRoutes(): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(API)) {
    if (!entry.endsWith('.py')) continue;
    const source = readFileSync(`${API}${entry}`, 'utf8');
    for (const match of source.matchAll(/@router\.(get|post)\("([^"]+)"/g)) {
      found.push(`${(match[1] as string).toUpperCase()} ${match[2] as string}`);
    }
  }
  return found.sort();
}

describe('the REST catalogue equals the route decorators', () => {
  // A regex that stops matching would turn both sides into empty lists and the
  // comparison into a tautology.
  it('actually read the decorators', () => {
    expect(decoratedRoutes().length).toBeGreaterThan(5);
  });

  it('covers every route, and invents none', () => {
    expect(ROUTE_KEYS).toEqual(decoratedRoutes());
  });
});

describe('the catalogue is well formed', () => {
  it('gives every POST a request schema and every GET none', () => {
    for (const route of ROUTES) {
      expect(route.request === undefined, `${route.method} ${route.path}`).toBe(
        route.method === 'GET',
      );
    }
  });

  it('has no duplicate path', () => {
    expect(new Set(ROUTE_KEYS).size).toBe(ROUTE_KEYS.length);
  });
});

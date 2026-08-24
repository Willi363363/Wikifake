// The routes are mounted. Nothing here talks to a database: importing this module
// must not open a connection, which is the reason `auth()` is lazy — and this
// test is what would fail if somebody made it eager.
import { describe, expect, it } from 'vitest';

import * as route from './route.js';

describe('/api/auth/*', () => {
  it('answers GET and POST', () => {
    expect(typeof route.GET).toBe('function');
    expect(typeof route.POST).toBe('function');
  });

  it('is never prerendered', () => {
    expect(route.dynamic).toBe('force-dynamic');
  });
});

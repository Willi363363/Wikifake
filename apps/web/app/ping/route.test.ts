import { describe, expect, it } from 'vitest';

import { GET } from './route.js';

describe('C7.1 — GET /ping', () => {
  it('answers exactly {"status": "alive"}', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    // Byte for byte: load balancers match on this, and "roughly the same JSON"
    // is what a probe cannot be written against.
    expect(await response.text()).toBe('{"status":"alive"}');
  });

  it('says it is JSON', () => {
    expect(GET().headers.get('content-type')).toBe('application/json');
  });
});

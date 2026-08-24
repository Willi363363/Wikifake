// The encoder is a guard, not a formatter. C1.1 says the solution never leaves
// the server, and the mechanism that enforces it is Zod stripping what a schema
// does not declare — so these tests are about what does *not* come out.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { json } from './respond.js';

const view = z.object({ topic: z.string(), totalFakes: z.number().int() });

describe('json', () => {
  it('serves what the schema declares', async () => {
    const response = json(view, { topic: 'Chocolat', totalFakes: 3 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ topic: 'Chocolat', totalFakes: 3 });
  });

  it('drops what the schema does not declare', async () => {
    // The failure this prevents: a handler spreading the solution into a payload
    // "for later". It disappears on encoding rather than reaching a console.
    const leaky = { topic: 'Chocolat', totalFakes: 3, hint: 'THE ANSWER' };
    const body = await json(view, leaky as z.infer<typeof view>).text();

    expect(body).not.toContain('THE ANSWER');
    expect(body).not.toContain('hint');
  });

  it('throws rather than serve a payload the contract refuses', () => {
    expect(() => json(view, { topic: 'Chocolat', totalFakes: 1.5 })).toThrow();
  });

  it('carries the status and headers it was given', () => {
    const response = json(
      view,
      { topic: 'x', totalFakes: 1 },
      {
        status: 201,
        headers: { 'cache-control': 'no-store' },
      },
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-type')).toBe('application/json');
  });
});

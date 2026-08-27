import { healthApi } from '@wikifake/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import { GET } from './route.js';

const KEPT = { ...process.env };

afterEach(() => {
  process.env = { ...KEPT };
});

describe('C7.2 — GET /api/health', () => {
  it('answers a payload its own contract accepts', async () => {
    process.env['RENDER_GIT_COMMIT'] = 'f'.repeat(40);
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');

    const parsed = healthApi.healthResponse.safeParse(await response.json());
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it('serves the fields the probe reads', async () => {
    process.env['RENDER_GIT_COMMIT'] = 'abcdef1234567890abcdef1234567890abcdef12';
    const body = (await GET().json()) as Record<string, unknown>;

    // `deploy-check.yml` reads exactly these two, by these names. Everything else
    // on this endpoint could be renamed without the probe noticing; these two
    // cannot, and that is the whole reason it is asserted separately.
    expect(body['commit']).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(typeof body['version']).toBe('string');
    expect(body['version']).not.toBe('');
  });

  it('answers even with nothing configured at all', async () => {
    // Deleting the keys rather than replacing the object: `NodeJS.ProcessEnv`
    // requires `NODE_ENV` once Next's types are loaded, and the point of the test
    // is the absence of *these* variables, not of the whole environment.
    for (const name of [
      'RENDER_GIT_COMMIT',
      'GIT_COMMIT',
      'SOURCE_COMMIT',
      'MODEL_NAME',
      'GOOGLE_GENERATIVE_AI_API_KEY',
    ]) {
      Reflect.deleteProperty(process.env, name);
    }
    const response = GET();

    // The probe has to get an answer when the database and the cache are gone:
    // this handler validates no environment, so there is nothing here to fail.
    expect(response.status).toBe(200);
    expect(healthApi.healthResponse.safeParse(await response.json()).success).toBe(true);
  });
});

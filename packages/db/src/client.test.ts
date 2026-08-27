// 2.1's criterion: starting without `DATABASE_URL` fails while naming the
// variable.
//
// It is the whole point of routing the URL through the typed environment. The
// alternative is `process.env.DATABASE_URL` read at the point of use, which
// surfaces as a connection error under load rather than a refusal at startup.
import { describe, expect, it } from 'vitest';

import { connectFromEnv } from './client.js';

const COMPLETE = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/wikifake',
  REDIS_URL: 'redis://localhost:6379',
  GOOGLE_GENERATIVE_AI_API_KEY: 'dummy-key-for-this-test',
};

describe('connecting from the environment', () => {
  it('names DATABASE_URL when it is missing', () => {
    const { DATABASE_URL: _omitted, ...withoutUrl } = COMPLETE;
    expect(() => connectFromEnv(withoutUrl)).toThrow(/DATABASE_URL/);
  });

  // An `https://` database URL is a valid URL and a useless one, so the protocol
  // is part of the validation.
  it('names DATABASE_URL when it is not a postgres URL', () => {
    expect(() =>
      connectFromEnv({ ...COMPLETE, DATABASE_URL: 'https://example.org' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('never puts a value in the message: it could be a password', () => {
    try {
      connectFromEnv({ ...COMPLETE, DATABASE_URL: 'https://user:hunter2@example.org' });
      expect.unreachable('should have refused');
    } catch (error) {
      expect((error as Error).message).not.toContain('hunter2');
    }
  });
});

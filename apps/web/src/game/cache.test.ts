// A cache outage is not a failed request.
//
// C4.6 counts a miss and an unreachable cache as different things, and
// `@wikifake/article` already reports `unavailable` instead of throwing. What is
// tested here is that the connection is as forgiving as the code above it — the
// place where a rejected promise, memoised, would keep the cache "down" for the
// lifetime of the process long after Redis came back.
import { describe, expect, it } from 'vitest';

import { articleCache } from './cache.js';

/** A port nothing is listening on: the connection is refused, fast. */
const UNREACHABLE = 'redis://127.0.0.1:1';

function envWith(redisUrl: string) {
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    DATABASE_URL: 'postgres://user:pass@localhost:5432/wikifake',
    REDIS_URL: redisUrl,
    GOOGLE_GENERATIVE_AI_API_KEY: 'a-key',
    MODEL_NAME: 'gemini-3.1-flash-lite',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
  } as const;
}

describe('the article cache, when Redis is not there', () => {
  it('reports the outage instead of throwing', async () => {
    const cache = articleCache(envWith(UNREACHABLE));
    await expect(cache.get('chat')).resolves.toMatchObject({ kind: 'unavailable' });
  });

  // Twice, deliberately. A memoised rejected promise would make the second call
  // report the *first* failure forever, so a Redis that came back would never be
  // used again — and, worse, the rejection would surface as an unhandled one.
  it('tries again on the next request', async () => {
    const cache = articleCache(envWith(UNREACHABLE));

    await expect(cache.get('chat')).resolves.toMatchObject({ kind: 'unavailable' });
    await expect(cache.get('chat')).resolves.toMatchObject({ kind: 'unavailable' });
    await expect(cache.stats()).resolves.toBeNull();
  });

  it('lets a write fail without taking the round with it', async () => {
    const cache = articleCache(envWith(UNREACHABLE));
    const entry = {
      article: {
        topic: 'Chat',
        paragraphs: ['Un paragraphe.'],
        totalFakes: 1,
        wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
      },
      solution: [
        {
          paragraphIndex: 1,
          falseInfoNumber: 1,
          falseStatement: 'Un paragraphe.',
          originalText: 'Un autre paragraphe.',
          explanation: 'La vérité.',
          hint: 'Vérifiez.',
        },
      ],
      html: '<p>Un paragraphe.</p>',
    };

    await expect(cache.put('chat', entry)).resolves.toMatchObject({
      kind: 'unavailable',
    });
  });
});

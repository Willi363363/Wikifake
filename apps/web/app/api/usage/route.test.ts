// 4.7's criterion: after generations, both measures are exact — and identical
// after a restart of the handler.
//
// The restart is the whole point. `usage.py` keeps its counters in a process, so
// the cost per game is only ever an order of magnitude for the hours since the
// last deployment; the number this endpoint exists to produce is thrown away
// precisely when someone would compare two of them.
//
// C4.6 is the other one: `perGeneratedGame` must not be diluted by cache hits. A
// game served from the cache cost nothing, and averaging it in would make
// generation look cheaper than it is — which is the direction that flatters the
// answer.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ArticleCache, CachedArticle, CacheStats } from '@wikifake/article';
import type { TestDatabase } from '@wikifake/db/testing';

import { createAuth } from '../../../src/auth/auth.js';
import { handleStart } from '../../../src/game/start.js';
import { handleUsage } from '../../../src/game/usage.js';
import {
  openWebTestDatabase,
  webTestDatabaseUrl,
} from '../../../src/testing/database.js';
import {
  falsifier,
  refuser,
  wikipedia,
  HINT,
  ORIGINAL,
  PAGE,
  SEARCH,
  TRUTH,
} from '../../../src/testing/round.js';
import type { RoundDependencies } from '../../../src/game/round.js';
import type { UsageContext } from '../../../src/game/usage.js';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

/** What the mocked model reports for every call it answers. */
const INPUT_TOKENS = 500;
const OUTPUT_TOKENS = 90;

const STATS: CacheStats = {
  categories: 2,
  articles: 7,
  maxCategories: 40,
  variantsPerCategory: 3,
  ttlSeconds: 21_600,
};

interface Usage {
  readonly usage: {
    gamesGenerated: number;
    gamesServedFromCache: number;
    byKind: Record<string, { calls: number; failures: number; inputTokens: number }>;
    totals: { llmCalls: number; inputTokens: number; outputTokens: number };
    perGeneratedGame: { llmCalls: number; inputTokens: number; outputTokens: number };
    cacheHitRate: number;
  };
  readonly cache: CacheStats | null;
}

describe.skipIf(url === null)('4.7 — GET /api/usage', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });
  afterAll(async () => {
    await store.close();
  });
  beforeEach(async () => {
    await store.truncate();
  });

  /** A cache that answers `stats`, and can be told to hold an article. */
  function cacheHolding(entry: CachedArticle | null): ArticleCache {
    return {
      get: () =>
        Promise.resolve(entry === null ? { kind: 'miss' } : { kind: 'hit', entry }),
      put: () => Promise.resolve({ kind: 'stored' }),
      stats: () => Promise.resolve(STATS),
    };
  }

  /** Every deployment reads the same rows: a fresh context is a restart. */
  const context = (cache: ArticleCache | null = cacheHolding(null)): UsageContext => ({
    db: store.db,
    cache,
  });

  const round = (overrides: Partial<RoundDependencies> = {}): RoundDependencies => ({
    db: store.db,
    cache: null,
    model: falsifier(),
    wiki: { language: 'fr', userAgent: 'WikiFake/test (suite)' },
    transport: wikipedia([SEARCH, PAGE]),
    seed: () => 7,
    ...overrides,
  });

  async function play(overrides: Partial<RoundDependencies> = {}): Promise<Response> {
    return handleStart(
      {
        auth: createAuth({ db: store.db, secret: SECRET, baseURL: BASE }),
        round: round(overrides),
      },
      new Request(`${BASE}/api/game/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: 'chat' }),
      }),
    );
  }

  const report = async (
    cache: ArticleCache | null = cacheHolding(null),
  ): Promise<Usage> => (await handleUsage(context(cache))).json() as Promise<Usage>;

  /** A cached round, so a hit costs no model call. */
  const CACHED: CachedArticle = {
    article: {
      topic: 'Chat',
      paragraphs: ['Un paragraphe déjà falsifié, gardé en cache pour la prochaine fois.'],
      totalFakes: 1,
      wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
    },
    solution: [
      {
        paragraphIndex: 1,
        falseInfoNumber: 1,
        falseStatement:
          'Un paragraphe déjà falsifié, gardé en cache pour la prochaine fois.',
        originalText: `${ORIGINAL}-cache`,
        explanation: `${TRUTH}-cache`,
        hint: `${HINT}-cache`,
      },
    ],
    html: '<p>déjà falsifié</p>',
  };

  describe('before anything has happened', () => {
    it('answers zeroes rather than refusing to divide', async () => {
      const body = await report();

      expect(body.usage.gamesGenerated).toBe(0);
      expect(body.usage.cacheHitRate).toBe(0);
      expect(body.usage.perGeneratedGame).toEqual({
        llmCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
      });
      // A kind nobody has used is absent, not zero: listing it invites the
      // reader to wonder why it costs nothing.
      expect(body.usage.byKind).toEqual({});
    });
  });

  describe('C4.6 — what a generated game cost', () => {
    it('counts every generation and what it spent', async () => {
      await play();
      await play();

      const body = await report();
      expect(body.usage.gamesGenerated).toBe(2);
      expect(body.usage.gamesServedFromCache).toBe(0);
      expect(body.usage.totals).toEqual({
        llmCalls: 2,
        inputTokens: 2 * INPUT_TOKENS,
        outputTokens: 2 * OUTPUT_TOKENS,
      });
      expect(body.usage.perGeneratedGame).toEqual({
        llmCalls: 1,
        inputTokens: INPUT_TOKENS,
        outputTokens: OUTPUT_TOKENS,
      });
      expect(body.usage.byKind['falsification']).toMatchObject({
        calls: 2,
        failures: 0,
        inputTokens: 2 * INPUT_TOKENS,
      });
    });

    // The assertion the contract names the figure for. A cache hit is a game
    // that cost nothing; folding it into the average would make generation look
    // cheaper than it is.
    it('does not let a cache hit dilute the cost of generating', async () => {
      await play();
      const generatedOnly = await report();

      // Two rounds served from the cache: no model call, no generation.
      await play({
        cache: cacheHolding(CACHED),
        model: refuser(),
        transport: wikipedia([]),
      });
      await play({
        cache: cacheHolding(CACHED),
        model: refuser(),
        transport: wikipedia([]),
      });

      const body = await report();
      expect(body.usage.gamesGenerated).toBe(1);
      expect(body.usage.gamesServedFromCache).toBe(2);
      expect(body.usage.cacheHitRate).toBe(0.667);
      // Unchanged: still one generation, still what that one generation cost.
      expect(body.usage.perGeneratedGame).toEqual(generatedOnly.usage.perGeneratedGame);
      expect(body.usage.totals.llmCalls).toBe(1);
    });

    // C4.5 — a failure is recorded, counted as a failure, and is not a game. It
    // bought nothing, so it must not enter the price of one; but its cost being
    // invisible is exactly what `usage.py` does today.
    it('counts a failed generation as a failure and not as a game', async () => {
      await play();
      const before = await report();

      const failed = await play({ model: refuser() });
      expect(failed.status).toBe(502);

      const body = await report();
      expect(body.usage.gamesGenerated).toBe(1);
      expect(body.usage.byKind['falsification']).toMatchObject({ calls: 1, failures: 1 });
      expect(body.usage.perGeneratedGame).toEqual(before.usage.perGeneratedGame);
      expect(body.usage.totals).toEqual(before.usage.totals);
    });
  });

  // The criterion.
  describe('the numbers survive a restart', () => {
    it('reports the same figures from a context built from scratch', async () => {
      await play();
      await play({
        cache: cacheHolding(CACHED),
        model: refuser(),
        transport: wikipedia([]),
      });
      await play({ model: refuser() });

      const before = await report();
      // A new context over the same rows: no counter is carried between the two,
      // because there is no counter to carry.
      const after = await handleUsage({ db: store.db, cache: cacheHolding(null) });

      expect(await after.json()).toEqual(before);
      expect(before.usage.gamesGenerated).toBe(1);
      expect(before.usage.gamesServedFromCache).toBe(1);
      expect(before.usage.byKind['falsification']).toMatchObject({
        calls: 1,
        failures: 1,
      });
    });
  });

  describe('what the cache block says', () => {
    it('reports what the cache holds when it answers', async () => {
      expect((await report()).cache).toEqual(STATS);
    });

    // An outage is not an empty cache. Zeroes here would read as "the cache is
    // empty, generation is expensive" — a wrong answer to the one question this
    // endpoint settles.
    it('says null rather than zero when the cache does not answer', async () => {
      const down: ArticleCache = {
        get: () => Promise.resolve({ kind: 'unavailable', detail: 'refused' }),
        put: () => Promise.resolve({ kind: 'unavailable', detail: 'refused' }),
        stats: () => Promise.resolve(null),
      };

      const body = await report(down);
      expect(body.cache).toBeNull();
      // And the spend is still reported: the two do not depend on each other.
      expect(body.usage.gamesGenerated).toBe(0);
    });

    it('says null when the deployment has no cache at all', async () => {
      expect((await report(null)).cache).toBeNull();
    });
  });

  describe('what it never carries', () => {
    it('reports the spend and nothing about any article', async () => {
      await play();
      const body = await (await handleUsage(context())).text();

      for (const marker of [TRUTH, HINT, ORIGINAL]) {
        expect(body, `value "${marker}" survived`).not.toContain(marker);
      }
      expect(body).not.toContain('paragraphs');
      expect(body).not.toContain('topic');
    });
  });
});

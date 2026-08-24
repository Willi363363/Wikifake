// What the cache does when things are wrong: Redis down, an entry it cannot
// read, a category that expired. None of these may fail a generation, and none
// may be quietly counted as something they are not.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createArticleCache, type RedisCommands } from './cache.js';
import { cachedArticle } from './fixture.js';
import { indexKey, CACHE_TTL_SECONDS, variantsKey } from './keys.js';

/** This file's own keys: Vitest runs test files in parallel. */
const NS = 'test:cache-failure';
import { openTestRedis, testRedisUrl, type TestRedis } from '../testing/redis.js';

const url = testRedisUrl();

describe('a cache whose Redis is unreachable', () => {
  const broken: RedisCommands = {
    eval: () => Promise.reject(new Error('ECONNREFUSED 127.0.0.1:6379')),
  };
  const cache = createArticleCache({ redis: broken, now: () => 0 });

  // Three cases, not two. Folding an outage into "miss" would make
  // `cacheHitRate` partly a measure of Redis uptime, and would bill a fleet of
  // generations to a cache that was simply down — with nothing in the numbers
  // saying so.
  it('reports a lookup as unavailable, not as a miss', async () => {
    const found = await cache.get('Chocolat');
    expect(found.kind).toBe('unavailable');
    if (found.kind !== 'unavailable') return;
    expect(found.detail).toContain('ECONNREFUSED');
  });

  it('reports a write as unavailable rather than throwing', async () => {
    const written = await cache.put('Chocolat', cachedArticle('a'));
    expect(written.kind).toBe('unavailable');
  });

  it('answers null for its stats, which is not the same as empty', async () => {
    expect(await cache.stats()).toBeNull();
  });

  it('never rejects, whatever the driver does', async () => {
    const hostile: RedisCommands = {
      eval: () => {
        throw 'not even an Error';
      },
    };
    const rough = createArticleCache({ redis: hostile, now: () => 0 });
    await expect(rough.get('Chocolat')).resolves.toMatchObject({ kind: 'unavailable' });
    await expect(rough.put('Chocolat', cachedArticle('a'))).resolves.toMatchObject({
      kind: 'unavailable',
    });
  });
});

describe.skipIf(url === null)('the cache, against a real Redis', () => {
  let store: TestRedis;
  let clock: number;

  const cacheAt = () =>
    createArticleCache({ redis: store.redis, now: () => clock, namespace: NS });

  beforeAll(async () => {
    store = await openTestRedis(url as string, NS);
  });

  beforeEach(async () => {
    await store.flush();
    clock = 1_700_000_000_000;
  });

  afterAll(async () => {
    await store.close();
  });

  it('treats an entry it cannot read as a miss, not as a crash', async () => {
    // Written straight into the list, the way a previous deployment with another
    // payload shape would have left it. The namespace is versioned to make this
    // rare; the schema is what makes it harmless when the version is not bumped.
    await store.redis.eval(`redis.call('RPUSH', KEYS[1], ARGV[1]) return 1`, {
      keys: [variantsKey(NS, 'chocolat')],
      arguments: [`${String(clock)}\n{"article":{"topic":"Chocolat"}}`],
    });

    expect(await cacheAt().get('Chocolat')).toEqual({ kind: 'miss' });
  });

  it('treats an entry that is not JSON as a miss', async () => {
    await store.redis.eval(`redis.call('RPUSH', KEYS[1], ARGV[1]) return 1`, {
      keys: [variantsKey(NS, 'chocolat')],
      arguments: [`${String(clock)}\nnot json at all`],
    });

    expect(await cacheAt().get('Chocolat')).toEqual({ kind: 'miss' });
  });

  // D14 — the Python returns from `get` before touching its LRU list when every
  // entry has expired, so the key stays in that list forever. The bound then
  // applies to categories the store no longer holds, evicting live ones to make
  // room for phantoms. Here the two are deleted together, and this is the test
  // that says so.
  it('leaves no phantom in the index when a category expires', async () => {
    const cache = cacheAt();
    await cache.put('Chocolat', cachedArticle('a'));
    expect(await indexSize()).toBe(1);

    clock += CACHE_TTL_SECONDS * 1000 + 1;
    expect(await cache.get('Chocolat')).toEqual({ kind: 'miss' });

    expect(await indexSize()).toBe(0);
  });

  it('counts what it holds, and not what has expired', async () => {
    const cache = cacheAt();
    await cache.put('Chocolat', cachedArticle('a'));
    await cache.put('Chat', cachedArticle('a'));

    expect(await cache.stats()).toEqual({
      categories: 2,
      articles: 2,
      maxCategories: 200,
      variantsPerCategory: 3,
      ttlSeconds: CACHE_TTL_SECONDS,
    });

    // The Python's `stats()` sums raw list lengths while its `get` and `put`
    // filter, so the number it publishes on `/api/usage` outlives the entries it
    // describes. The second half of D14.
    clock += CACHE_TTL_SECONDS * 1000 + 1;
    expect(await cacheAt().stats()).toMatchObject({ categories: 0, articles: 0 });
  });

  it('reports the bounds it was built with', async () => {
    const bounded = createArticleCache({
      redis: store.redis,
      now: () => clock,
      namespace: NS,
      ttlSeconds: 60,
      variantsPerCategory: 1,
      maxCategories: 5,
    });
    expect(await bounded.stats()).toMatchObject({
      maxCategories: 5,
      variantsPerCategory: 1,
      ttlSeconds: 60,
    });
  });

  async function indexSize(): Promise<number> {
    const size = await store.redis.eval(`return redis.call('ZCARD', KEYS[1])`, {
      keys: [indexKey(NS)],
      arguments: [],
    });
    return Number(size);
  }
});

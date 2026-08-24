// C4 against a real Redis. Nothing here runs against a fake: the whole point of
// the step is that the rules hold in the store, and a fake would only prove the
// fake.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createArticleCache, type ArticleCache } from './cache.js';
import { cachedArticle } from './fixture.js';
import { CACHE_TTL_SECONDS } from './keys.js';
import { openTestRedis, testRedisUrl, type TestRedis } from '../testing/redis.js';

const url = testRedisUrl();

describe.skipIf(url === null)('the article cache, on Redis', () => {
  let store: TestRedis;
  let clock: number;
  let cache: ArticleCache;

  beforeAll(async () => {
    store = await openTestRedis(url as string);
  });

  beforeEach(async () => {
    await store.flush();
    // A fixed clock, moved by the tests: the TTL is a rule, and a rule tested by
    // sleeping is a rule tested slowly and flakily.
    clock = 1_700_000_000_000;
    cache = createArticleCache({ redis: store.redis, now: () => clock });
  });

  afterAll(async () => {
    await store.close();
  });

  it('misses before anything is stored', async () => {
    expect(await cache.get('Chocolat')).toEqual({ kind: 'miss' });
  });

  it('returns what it was given', async () => {
    const stored = cachedArticle('a');
    expect(await cache.put('Chocolat', stored)).toEqual({ kind: 'stored' });

    const found = await cache.get('Chocolat');
    expect(found.kind).toBe('hit');
    if (found.kind !== 'hit') return;
    expect(found.entry).toEqual(stored);
  });

  describe('C4.1 — normalised keys', () => {
    it.each(['chocolat', '  CHOCOLAT  ', 'Chôcolat'])(
      'serves what was stored under "Chocolat" to %o',
      async (spelling) => {
        await cache.put('Chocolat', cachedArticle('a'));
        expect((await cache.get(spelling)).kind).toBe('hit');
      },
    );

    it('ignores an empty category on the way in and on the way out', async () => {
      expect(await cache.put('   ', cachedArticle('a'))).toEqual({ kind: 'ignored' });
      expect(await cache.get('   ')).toEqual({ kind: 'miss' });
      // And nothing was written under a blank key.
      expect(await cache.stats()).toMatchObject({ categories: 0, articles: 0 });
    });
  });

  describe('C4.2 — copied in and out', () => {
    it('does not let a reader mutate the store', async () => {
      await cache.put('Chocolat', cachedArticle('a'));

      const first = await cache.get('Chocolat');
      if (first.kind !== 'hit') throw new Error('expected a hit');
      // Deep, not the three keys the Python copies: a nested field inside a
      // position is exactly what `_copy` shares by reference.
      const position = first.entry.solution[0];
      if (position === undefined) throw new Error('expected a position');
      position.explanation = 'MUTATED';
      first.entry.article.paragraphs[0] = 'MUTATED';

      const second = await cache.get('Chocolat');
      if (second.kind !== 'hit') throw new Error('expected a hit');
      expect(second.entry.solution[0]?.explanation).toBe('La vérité de la variante a.');
      expect(second.entry.article.paragraphs[0]).not.toBe('MUTATED');
    });

    it('does not let the writer mutate what it stored', async () => {
      const stored = cachedArticle('a');
      await cache.put('Chocolat', stored);
      stored.article.paragraphs[0] = 'MUTATED AFTER THE PUT';

      const found = await cache.get('Chocolat');
      if (found.kind !== 'hit') throw new Error('expected a hit');
      expect(found.entry.article.paragraphs[0]).not.toBe('MUTATED AFTER THE PUT');
    });

    it('gives two readers two object graphs', async () => {
      await cache.put('Chocolat', cachedArticle('a'));
      const one = await cache.get('Chocolat');
      const two = await cache.get('Chocolat');
      if (one.kind !== 'hit' || two.kind !== 'hit') throw new Error('expected hits');
      expect(one.entry).not.toBe(two.entry);
      expect(one.entry.solution[0]).not.toBe(two.entry.solution[0]);
    });
  });

  describe('C4.3 — TTL, variants, categories', () => {
    it('forgets an entry older than the TTL', async () => {
      await cache.put('Chocolat', cachedArticle('a'));
      clock += CACHE_TTL_SECONDS * 1000;
      expect((await cache.get('Chocolat')).kind).toBe('hit');

      clock += 1;
      expect(await cache.get('Chocolat')).toEqual({ kind: 'miss' });
    });

    it('keeps three variants and drops the oldest by insertion', async () => {
      for (const variant of ['a', 'b', 'c', 'd']) {
        await cache.put('Chocolat', cachedArticle(variant));
        clock += 1000;
      }

      expect(await cache.stats()).toMatchObject({ categories: 1, articles: 3 });

      const served = new Set<string>();
      for (let turn = 0; turn < 6; turn += 1) {
        const found = await cache.get('Chocolat');
        if (found.kind === 'hit') served.add(found.entry.html);
      }
      expect([...served].sort()).toEqual([
        '<p>variante b</p>',
        '<p>variante c</p>',
        '<p>variante d</p>',
      ]);
    });

    it('evicts the least recently served category, not the oldest', async () => {
      const bounded = createArticleCache({
        redis: store.redis,
        now: () => clock,
        maxCategories: 2,
      });

      await bounded.put('Premier', cachedArticle('1'));
      clock += 1000;
      await bounded.put('Deuxieme', cachedArticle('2'));
      clock += 1000;

      // Serving the oldest makes it the most recent — this is what "LRU" means
      // and what a naive "drop the oldest write" would get wrong.
      expect((await bounded.get('Premier')).kind).toBe('hit');
      clock += 1000;

      await bounded.put('Troisieme', cachedArticle('3'));

      expect((await bounded.get('Deuxieme')).kind).toBe('miss');
      expect((await bounded.get('Premier')).kind).toBe('hit');
      expect((await bounded.get('Troisieme')).kind).toBe('hit');
    });
  });

  describe('C4.4 — variants served in rotation', () => {
    it('serves every variant once before repeating one', async () => {
      for (const variant of ['a', 'b', 'c'])
        await cache.put('Chocolat', cachedArticle(variant));

      const cycle: string[] = [];
      for (let turn = 0; turn < 3; turn += 1) {
        const found = await cache.get('Chocolat');
        if (found.kind !== 'hit') throw new Error('expected a hit');
        cycle.push(found.entry.html);
      }

      // The Python calls `random.choice`, which can return one variant three
      // times running: it satisfies "not the same article forever" only on
      // average. A counter satisfies it every cycle, which is what C4.4 says.
      expect(new Set(cycle).size).toBe(3);
    });

    it('comes back round to the first variant', async () => {
      for (const variant of ['a', 'b'])
        await cache.put('Chocolat', cachedArticle(variant));

      const seen: string[] = [];
      for (let turn = 0; turn < 4; turn += 1) {
        const found = await cache.get('Chocolat');
        if (found.kind !== 'hit') throw new Error('expected a hit');
        seen.push(found.entry.html);
      }
      expect(seen[0]).toBe(seen[2]);
      expect(seen[1]).toBe(seen[3]);
    });

    it('rotates each category on its own counter', async () => {
      for (const variant of ['a', 'b']) {
        await cache.put('Chocolat', cachedArticle(variant));
        await cache.put('Chat', cachedArticle(variant));
      }

      const chocolat = await cache.get('Chocolat');
      const chat = await cache.get('Chat');
      if (chocolat.kind !== 'hit' || chat.kind !== 'hit')
        throw new Error('expected hits');
      expect(chocolat.entry.html).toBe(chat.entry.html);
    });
  });
});

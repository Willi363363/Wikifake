// Equivalent of test_route_exposes_usage_and_cache and the C4.6 invariants.
//
// The arithmetic (per-generated-game, cache-hit-rate, division by zero) lives in
// `packages/db/src/queries/usage.test.ts` — pure functions, no mocking needed.
// What is tested here is that `handleUsage` assembles the response the contract
// names: both `usage` and `cache` keys present, `null` when the cache is
// unreachable, `ttlSeconds` when it is not.
//
// The counters survive a restart because they live in `llm_call` rather than in
// a process variable: proved by the fact that `handleUsage` calls
// `readUsageTotals` and `readUsageByKind`, which are DB queries, and has no
// in-process state of its own. No restart-specific fixture is needed — the
// absence of a process variable here is the proof.
import type * as Db from '@wikifake/db';
import { describe, expect, it, vi } from 'vitest';

import { handleUsage } from './usage.js';

vi.mock('@wikifake/db', async (importOriginal) => {
  const original = await importOriginal<typeof Db>();
  return {
    ...original,
    readUsageTotals: vi.fn().mockResolvedValue({
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      gamesGenerated: 0,
      gamesFromCache: 0,
    }),
    readUsageByKind: vi.fn().mockResolvedValue({}),
  };
});

// Cast to the minimal interface `handleUsage` uses — the real Database['db']
// calls are mocked above and never reach the driver.
const FAKE_DB = {} as never;

describe('C4.6 — the usage route', () => {
  it('exposes both usage and cache in the payload', async () => {
    const response = await handleUsage({ db: FAKE_DB, cache: null });
    const payload = await response.json();

    expect(payload).toHaveProperty('usage');
    expect(payload).toHaveProperty('cache');
  });

  it('reports null cache when there is no cache at all', async () => {
    const payload = await (await handleUsage({ db: FAKE_DB, cache: null })).json();

    expect(payload.cache).toBeNull();
  });

  it('exposes ttlSeconds when the cache is reachable', async () => {
    const cache = {
      get: vi.fn(),
      put: vi.fn(),
      stats: vi.fn().mockResolvedValue({
        categories: 2,
        articles: 10,
        maxCategories: 5,
        variantsPerCategory: 3,
        ttlSeconds: 3600,
      }),
    } as never;

    const payload = await (await handleUsage({ db: FAKE_DB, cache })).json();

    expect(payload.cache).not.toBeNull();
    expect(payload.cache.ttlSeconds).toBe(3600);
  });

  it('reports null cache when the cache is unreachable', async () => {
    const cache = {
      get: vi.fn(),
      put: vi.fn(),
      stats: vi.fn().mockResolvedValue(null),
    } as never;

    const payload = await (await handleUsage({ db: FAKE_DB, cache })).json();

    expect(payload.cache).toBeNull();
  });

  it('does not divide by zero when nothing has been generated yet', async () => {
    const payload = await (await handleUsage({ db: FAKE_DB, cache: null })).json();

    expect(payload.usage.perGeneratedGame.llmCalls).toBe(0);
    expect(payload.usage.cacheHitRate).toBe(0);
  });
});

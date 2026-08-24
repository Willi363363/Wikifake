// A real Redis for a test, and nothing left behind.
//
// The driver is imported here and declared as a **devDependency**: the cache
// itself takes a `RedisCommands` port, so nothing that consumes `@wikifake/article`
// at runtime drags a Redis client along. This file is the one place that needs a
// concrete one, because a cache whose only test runs against a fake proves that
// the fake matches the fake.
import { createClient } from 'redis';

import type { RedisCommands } from '../cache/cache.js';

/**
 * Where the test Redis is, or why there is none.
 *
 * Absent locally is a skip; absent in CI is a failure — the same contract as
 * `testDatabaseUrl` in `@wikifake/db`. A suite that quietly skips its integration
 * tests on the machine that decides whether to merge reports green for work it
 * never did.
 */
export function testRedisUrl(): string | null {
  const url = process.env['REDIS_URL'];
  if (url !== undefined && url !== '') return url;
  if (process.env['CI'] === 'true') {
    throw new Error(
      'REDIS_URL is required in CI: the integration tests must actually run',
    );
  }
  return null;
}

export interface TestRedis {
  readonly redis: RedisCommands;
  /** Removes this package's keys only. */
  readonly flush: () => Promise<void>;
  readonly close: () => Promise<void>;
}

/**
 * @param namespace keys to own and to clean up. Each test file passes its own, so
 * two files running in parallel — Vitest's default — cannot flush each other's
 * entries. That race made one normalisation case fail about one run in three.
 */
export async function openTestRedis(url: string, namespace: string): Promise<TestRedis> {
  const client = createClient({ url });
  await client.connect();

  // `KEYS` rather than `SCAN`, and a pattern rather than `FLUSHALL`. The pattern
  // because phase 5 puts room state in the same Redis and a test that flushes
  // everything would take it with it; `KEYS` because this runs against a local
  // instance holding a handful of keys, where the argument for `SCAN` — not
  // blocking a production server — does not apply and costs clarity.
  const flush = async (): Promise<void> => {
    const keys = await client.keys(`${namespace}:*`);
    if (keys.length > 0) await client.del(keys);
  };

  await flush();
  return { redis: client, flush, close: async () => void (await client.quit()) };
}

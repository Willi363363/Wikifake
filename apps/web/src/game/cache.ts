// The concrete Redis behind `@wikifake/article`'s cache port.
//
// The package takes a `RedisCommands` and owns no connection, so this is the one
// place in the application that knows a driver exists. Everything below is about
// one question: a cache outage must never become a failed request. C4.6 counts a
// cache miss and an unreachable cache as different things, and the cache itself
// already reports `unavailable` rather than throwing — the connection has to be
// as forgiving as the code above it.
import {
  createArticleCache,
  type ArticleCache,
  type RedisCommands,
} from '@wikifake/article';
import type { Env } from '@wikifake/env';
import { createClient } from 'redis';

/**
 * How long the cache gets before the round goes on without it.
 *
 * The cache exists to make a round cheaper, so it must never make one slower
 * than generating would have been. Left to itself, node-redis reconnects with a
 * backoff and `connect()` simply does not settle: a Redis that is down would not
 * degrade the round, it would hang it — and a request hanging on an optional
 * dependency is the outage spreading rather than being contained.
 */
export const CACHE_TIMEOUT_MS = 2_000;

/** Rejects if `work` has not settled in time, so a hung cache is a missing one. */
async function withinTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`the cache did not answer in ${String(CACHE_TIMEOUT_MS)}ms`)),
      CACHE_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([work, expiry]);
  } finally {
    // Otherwise the timer keeps the process alive for two seconds after every
    // successful call — which, in a test run, is two seconds per assertion.
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * A connection opened on first use, and reopened after a failure.
 *
 * Lazy because importing this module must not require a reachable Redis — a
 * route that only needs the database should not fail because the cache is down.
 * Reset on rejection because a memoised failed promise is a cache that stays
 * unavailable for the lifetime of the process, long after Redis came back.
 */
function lazyClient(url: string): RedisCommands {
  // Typed as the port rather than as a client: `RedisClientType` is generic over
  // five parameters whose defaults differ between `createClient` and `connect`,
  // and naming either of them is how a driver upgrade becomes an unreadable
  // variance error. The port is the only surface this file uses anyway.
  let pending: Promise<RedisCommands> | undefined;

  const connect = (): Promise<RedisCommands> => {
    if (pending !== undefined) return pending;

    const attempt: Promise<RedisCommands> = createClient({
      url,
      socket: {
        connectTimeout: CACHE_TIMEOUT_MS,
        // One attempt, and no background reconnection. Retrying here would leave
        // a request waiting on a cache already known to be down; the next request
        // opens a fresh connection instead, which is the same recovery without
        // the round paying for it.
        reconnectStrategy: false,
      },
    })
      // node-redis throws on an `error` event with no listener, and the errors
      // it emits are exactly the ones the cache is designed to survive. There is
      // nothing to log: the outcome reaches the caller as `unavailable`, which is
      // what `/api/usage` reports.
      .on('error', () => undefined)
      .connect()
      .catch((error: unknown) => {
        // Only if nothing has replaced it in the meantime: clearing a newer
        // attempt would reopen a connection that is already fine.
        if (pending === attempt) pending = undefined;
        throw error;
      });

    pending = attempt;
    return attempt;
  };

  return {
    async eval(script, options) {
      const client = await withinTimeout(connect());
      return withinTimeout(client.eval(script, options));
    },
  };
}

/** The article cache for this deployment. */
export function articleCache(env: Env): ArticleCache {
  return createArticleCache({ redis: lazyClient(env.REDIS_URL), now: () => Date.now() });
}

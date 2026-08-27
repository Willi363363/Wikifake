// The one Redis command this service needs, and a client that survives an
// outage.
//
// A port rather than a client, for the reason `@wikifake/article` gives for its
// cache: the code that decides things has no business owning a connection, and a
// driver in the signature is a driver every test drags along.
//
// The port is declared here rather than imported from `@wikifake/article`,
// which has an identical one. Importing it would make the realtime service
// depend on the package that produces articles for the sake of six lines of
// interface — an edge in the dependency graph that says something untrue about
// what this service is.
//
// The connection below is close to `apps/web/src/game/cache.ts`, deliberately
// and for now. Two callers is a coincidence; a `packages/redis` is worth having
// at the third, and extracting it earlier would mean guessing which of the two
// shapes is the general one. The difference between them is the interesting
// part: the article cache survives an outage and reports it, and a room cannot.
import { createClient } from 'redis';

export interface RedisCommands {
  // Mutable arrays, deliberately: a `readonly` parameter here would make the
  // real client fail to satisfy the port, since a method's parameter type has to
  // accept at least what the port promises to pass.
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
  hmGet(key: string, fields: string[]): Promise<(string | null)[]>;
}

/**
 * How long Redis gets before the caller is told it is not there.
 *
 * Unlike the article cache, an unreachable Redis here is not survivable: the
 * room's state *is* the room. What the bound buys is a failure that arrives —
 * left to itself node-redis reconnects with a backoff and the call simply does
 * not settle, so a player waits on a spinner instead of being told.
 */
export const REDIS_TIMEOUT_MS = 2000;

async function withinTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiry = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis did not answer in ${String(REDIS_TIMEOUT_MS)}ms`)),
      REDIS_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([work, expiry]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * A connection opened on first use, and reopened after a failure.
 *
 * Lazy so importing this module does not require a reachable Redis, and reset on
 * rejection because a memoised failed promise keeps the service down for the
 * lifetime of the process, long after Redis came back.
 */
export function lazyRedis(url: string): RedisCommands {
  let pending: Promise<RedisCommands> | undefined;

  const connect = (): Promise<RedisCommands> => {
    if (pending !== undefined) return pending;

    const attempt: Promise<RedisCommands> = createClient({
      url,
      socket: {
        connectTimeout: REDIS_TIMEOUT_MS,
        // One attempt, and no background reconnection: retrying here leaves a
        // caller waiting on a connection already known to be down. The next call
        // opens a fresh one, which is the same recovery without the wait.
        reconnectStrategy: false,
      },
    })
      // node-redis throws on an `error` event with no listener, and the errors it
      // emits are the ones a caller already sees as a rejected promise.
      .on('error', () => undefined)
      .connect()
      .catch((error: unknown) => {
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

    async hmGet(key, fields) {
      const client = await withinTimeout(connect());
      return withinTimeout(client.hmGet(key, fields));
    },
  };
}

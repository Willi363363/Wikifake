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
 * Lazy so importing this module does not require a reachable Redis, and dropped
 * on failure because a memoised one keeps the service down for the lifetime of
 * the process, long after Redis came back.
 *
 * **Failure means two things and used to mean one.** A first `connect` that
 * rejects was always handled. A connection that *succeeds and then drops* — an
 * idle reaper, a Key Value restart, a network blip — was not: with
 * `reconnectStrategy: false` node-redis opens no new socket of its own, so the
 * memoised client stayed closed for ever and every call rejected with *the
 * client is closed*. On the socket service that is an instance answering "the
 * room could not be reached" to players sitting in a room, until it restarts.
 * Step O.3, from `12-realtime-debt.md`.
 *
 * **`isOpen` is what says so**, and it is measured rather than assumed: with no
 * reconnection strategy this client emits `error` twice and never emits `end`,
 * so there is no event to hang the recovery on. The flag is read on the way in
 * instead, which costs nothing and cannot be missed.
 */
export function lazyRedis(url: string): RedisCommands {
  let pending: Promise<RedisCommands> | undefined;
  /** The resolved client, while there is one. Read only to ask if it is open. */
  let opened: { isOpen: boolean } | undefined;

  const connect = (): Promise<RedisCommands> => {
    // A client that closed under us is not a client. Dropped here so the next
    // call opens a fresh one — which is what this function has always said it
    // does, and now does.
    if (opened !== undefined && !opened.isOpen) {
      pending = undefined;
      opened = undefined;
    }

    if (pending !== undefined) return pending;

    const client = createClient({
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
      .on('error', () => undefined);

    const attempt: Promise<RedisCommands> = client.connect().catch((error: unknown) => {
      if (pending === attempt) pending = undefined;
      throw error;
    });

    pending = attempt;
    // Recorded only once it has connected and only while it is still this
    // memo's client, so a connection superseded while it was opening does not
    // decide whether the current one is alive.
    void attempt.then(
      () => {
        if (pending === attempt) opened = client;
      },
      () => undefined,
    );
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

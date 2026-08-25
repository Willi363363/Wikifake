// One channel per room, so any instance serves any socket.
//
// This is what turns a fleet into a game. Until now an effect reached the
// sockets *this* process holds, so two players on two instances heard half a
// room each. Published to a channel, the same effect reaches every instance and
// each delivers to the sockets it happens to hold — nobody has to know where
// anybody is connected.
//
// A port, like everything else here. Redis pub/sub needs a second connection —
// a subscribing client may not run other commands — and that is a detail of the
// implementation rather than of the room.
import { createClient } from 'redis';

import { REDIS_TIMEOUT_MS } from './redis.js';

/** Undo a subscription. Called when the last local socket for a room goes. */
export type Unsubscribe = () => Promise<void>;

export interface Bus {
  publish(channel: string, payload: string): Promise<void>;
  /**
   * Listens on a channel until the returned function is called.
   *
   * The publisher hears its own messages. That is deliberate: delivery then has
   * exactly one path, and "did this instance already send it locally" stops
   * being a question anybody has to get right.
   */
  subscribe(channel: string, onMessage: (payload: string) => void): Promise<Unsubscribe>;
  close(): Promise<void>;
}

function connection(url: string) {
  return createClient({
    url,
    socket: { connectTimeout: REDIS_TIMEOUT_MS, reconnectStrategy: false },
  }).on('error', () => undefined);
}

/**
 * The connected client type, inferred.
 *
 * `RedisClientType` is generic over five parameters whose defaults differ
 * between `createClient` and the client it hands back, so naming it turns a
 * driver upgrade into an unreadable variance error about `RespVersions`.
 */
type Connected = Awaited<ReturnType<ReturnType<typeof connection>['connect']>>;

/**
 * A bus over Redis.
 *
 * Two connections: one to publish on, one to listen on. Both opened lazily, so
 * importing this module does not require a reachable Redis, and both cleared on
 * failure — a memoised rejection keeps the room unreachable long after Redis
 * came back.
 */
export function createRedisBus(url: string): Bus {
  let publisher: Promise<Connected> | undefined;
  let listener: Promise<Connected> | undefined;

  const publishing = (): Promise<Connected> => {
    if (publisher !== undefined) return publisher;
    const attempt = connection(url)
      .connect()
      .catch((error: unknown) => {
        if (publisher === attempt) publisher = undefined;
        throw error;
      });
    publisher = attempt;
    return attempt;
  };

  const listening = (): Promise<Connected> => {
    if (listener !== undefined) return listener;
    const attempt = connection(url)
      .connect()
      .catch((error: unknown) => {
        if (listener === attempt) listener = undefined;
        throw error;
      });
    listener = attempt;
    return attempt;
  };

  return {
    async publish(channel, payload) {
      await (await publishing()).publish(channel, payload);
    },

    async subscribe(channel, onMessage) {
      const client = await listening();
      await client.subscribe(channel, onMessage);

      return async () => {
        // A room whose last local socket left. Failing to unsubscribe would
        // leave this instance decoding messages for a room it serves nobody in.
        await client.unsubscribe(channel);
      };
    },

    async close() {
      for (const held of [publisher, listener]) {
        if (held === undefined) continue;
        await held.then(async (client) => client.quit()).catch(() => undefined);
      }
      publisher = undefined;
      listener = undefined;
    },
  };
}

/**
 * A bus that never leaves the process.
 *
 * For the suites that are not about crossing instances — the transport's, which
 * is about what a socket is allowed to send. Using Redis there would make every
 * one of those tests depend on a server that has nothing to do with what they
 * check.
 *
 * It is not a stand-in: `broadcast.test.ts` runs the real one against two
 * services and a real Redis, which is where the step's criterion lives.
 */
export function createLocalBus(): Bus {
  const listeners = new Map<string, Set<(payload: string) => void>>();

  return {
    publish(channel, payload) {
      for (const listener of listeners.get(channel) ?? []) listener(payload);
      return Promise.resolve();
    },

    subscribe(channel, onMessage) {
      const held = listeners.get(channel) ?? new Set();
      held.add(onMessage);
      listeners.set(channel, held);

      return Promise.resolve(async () => {
        held.delete(onMessage);
        if (held.size === 0) listeners.delete(channel);
        return Promise.resolve();
      });
    },

    close() {
      listeners.clear();
      return Promise.resolve();
    },
  };
}

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

/**
 * How long the listener waits before trying again, growing to two seconds.
 *
 * Only the listener retries — see `listening` below for why the publisher must
 * not — so this is the delay nobody is waiting through.
 */
function backoff(attempt: number): number {
  return Math.min(100 * 2 ** attempt, 2000);
}

/**
 * A connection for one of the bus's two halves.
 *
 * **They differ in exactly one way and it is the interesting one.** The
 * publisher has a caller awaiting a reply, so it must fail fast: retrying
 * behind its back leaves that caller waiting on a connection already known to
 * be down, which is the failure `REDIS_TIMEOUT_MS` exists to prevent. The
 * listener has no caller at all — what a listener that is down produces is
 * *silence*, and a room that looks connected and hears nothing is worse than an
 * error, because nothing anywhere says so.
 *
 * So the listener retries and the publisher does not. Step O.3.
 */
function connection(url: string, retrying: boolean) {
  return createClient({
    url,
    socket: {
      connectTimeout: REDIS_TIMEOUT_MS,
      reconnectStrategy: retrying ? backoff : false,
    },
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
 * The publishing connection: opened on first use, dropped when it closes.
 *
 * **Dropped on failure means two things**, and it used to mean one. A first
 * `connect` that rejects was always handled. A connection that succeeds and
 * then *drops* — an idle reaper, a Key Value restart, a network blip — was not:
 * with no reconnection strategy node-redis opens no new socket, so the memoised
 * client stayed closed for ever and every publish rejected with *the client is
 * closed*. Every effect the rules decided then reached nobody, on an instance
 * that looked healthy. Step O.3, from `12-realtime-debt.md`.
 *
 * `isOpen` is what says so, measured rather than assumed: with no reconnection
 * strategy this client emits `error` twice and never emits `end`, so there is
 * no event to hang the recovery on.
 */
function publishingConnection(url: string) {
  let pending: Promise<Connected> | undefined;
  let opened: ReturnType<typeof connection> | undefined;

  return {
    held(): Promise<Connected> {
      // A client that closed under us is not a client. Dropped here so the next
      // call opens a fresh one — the recovery without the wait.
      if (opened !== undefined && !opened.isOpen) {
        pending = undefined;
        opened = undefined;
      }
      if (pending !== undefined) return pending;

      const client = connection(url, false);
      const attempt = client.connect().catch((error: unknown) => {
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
    },

    async close(): Promise<void> {
      if (pending === undefined) return;
      await pending.then(async (client) => client.quit()).catch(() => undefined);
      pending = undefined;
      opened = undefined;
    },
  };
}

/**
 * A bus over Redis.
 *
 * Two connections: one to publish on, one to listen on. Both opened lazily, so
 * importing this module does not require a reachable Redis. What happens to
 * each when it drops is the asymmetry `connection` explains.
 */
export function createRedisBus(url: string): Bus {
  const publisher = publishingConnection(url);

  /**
   * The listening connection, which reconnects itself.
   *
   * **Its subscriptions come back with it, and that is node-redis's doing
   * rather than ours** — verified against 6.x rather than trusted: a client
   * killed mid-subscription reconnects and receives the next message on the
   * same channel with nothing re-subscribing it. A channel map kept here would
   * be a second copy of a fact the driver already holds, and the first thing to
   * disagree with it.
   */
  let listener: Promise<Connected> | undefined;

  const listening = (): Promise<Connected> => {
    if (listener !== undefined) return listener;
    const attempt = connection(url, true)
      .connect()
      .catch((error: unknown) => {
        // Only a connection that never opened. One that opened and dropped is
        // the driver's to restore, and clearing the memo here would strand the
        // subscriptions it is carrying.
        if (listener === attempt) listener = undefined;
        throw error;
      });
    listener = attempt;
    return attempt;
  };

  return {
    async publish(channel, payload) {
      await (await publisher.held()).publish(channel, payload);
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
      await publisher.close();
      if (listener !== undefined) {
        await listener.then(async (client) => client.quit()).catch(() => undefined);
        listener = undefined;
      }
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

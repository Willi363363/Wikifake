// Track O, steps O.1 to O.3 — what stops this service serving a room.
//
// Three defects found by a review on 2026-09-16 and written up in
// `plans/current-state/12-realtime-debt.md`. Every case below is the probe that
// found one, and **every one of them failed before its fix** — which is the
// point of the file, because the whole suite was green while all three were
// true. None of them is about a rule: they are about the service being there at
// all.
//
// Over real sockets and, for O.3, a real Redis. A fake cannot be sent an
// invalid UTF-8 sequence, cannot close at the wrong moment, and cannot have its
// connection killed under it.
import crypto from 'node:crypto';
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import { createLocalBus, createRedisBus } from './bus.js';
import { createOriginPolicy } from './origins.js';
import { lazyRedis } from './redis.js';
import { createRoomStore } from './rooms/store.js';
import { createLocalTokens } from './rooms/tokens.js';
import { createService, type Service } from './server.js';
import { stubArticles } from './testing/articles.js';
import { createLocalScheduler } from './timers/local.js';
import { open, until } from './testing/client.js';
import { testRedisUrl } from './testing/redis.js';

const ROOM = 'A1B2C3';
const APP = 'https://wikifake.example';

/**
 * The two commands the store uses, over a `Map`, with a latency.
 *
 * Not a stand-in for Redis — `store.test.ts` drives the real one. What this
 * buys is the **delay**, and O.2 is entirely about a delay: a hosted Redis
 * answers in tens of milliseconds and a loopback in tenths of one, so the
 * window the bug lives in is invisible on a developer's machine.
 */
function slowRedis(latencyMs: number) {
  const rooms = new Map<string, { revision: number; state: string }>();
  const wait = (): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, latencyMs));

  return {
    async hmGet(key: string): Promise<(string | null)[]> {
      await wait();
      const held = rooms.get(key);
      return held === undefined ? [null, null] : [String(held.revision), held.state];
    },
    async eval(
      script: string,
      options: { keys: string[]; arguments: string[] },
    ): Promise<unknown> {
      await wait();
      const key = options.keys[0] as string;
      const revision = rooms.get(key)?.revision ?? 0;
      if (String(revision) !== options.arguments[0]) return [0, String(revision)];
      if (script.includes('DEL')) {
        rooms.delete(key);
        return [1, '0'];
      }
      rooms.set(key, { revision: revision + 1, state: options.arguments[1] as string });
      return [1, String(revision + 1)];
    },
  };
}

let service: Service | undefined;

const start = async (latencyMs = 0): Promise<number> => {
  service = createService({
    origins: createOriginPolicy([APP]),
    roomExists: () => Promise.resolve(true),
    closeRoom: () => Promise.resolve(),
    recordResults: () => Promise.resolve(),
    rooms: createRoomStore({ redis: slowRedis(latencyMs), namespace: 'availability' }),
    bus: createLocalBus(),
    tokens: createLocalTokens(),
    articles: stubArticles(),
    scheduler: createLocalScheduler,
  });
  return service.listen(0);
};

afterEach(async () => {
  await service?.close();
  service = undefined;
});

describe('O.1 — a frame the receiver cannot read', () => {
  /**
   * The criterion, and it is about the process rather than about the room.
   *
   * `ws` emits `error` on the **WebSocket**, not only on the socket beneath it,
   * and an `error` event with no listener is what Node's `EventEmitter` throws.
   * Without the listener this case does not fail — it takes the runner down,
   * which is how the defect would read in production: not a refused message, an
   * instance that is gone.
   *
   * A raw client rather than `ws`, because `ws` will not send a frame this
   * malformed: the point is exactly that somebody can.
   *
   * The assertion is on `uncaughtException` rather than on the runner falling
   * over. Without the listener Vitest reports this as an *unhandled error* with
   * every case still green — the shape `10-test-debt.md` warns about, where the
   * job is red and no test is — so a case that only failed by taking the runner
   * down would be a case nobody could read.
   */
  it('does not take the service down, and the room is still served', async () => {
    const port = await start();

    const escaped: Error[] = [];
    const caught = (error: Error): void => void escaped.push(error);
    process.on('uncaughtException', caught);

    const raw = net.connect(port, '127.0.0.1');
    await new Promise((resolve) => raw.on('connect', resolve));
    raw.write(
      `GET /ws/${ROOM}/Mallory HTTP/1.1\r\n` +
        `Host: 127.0.0.1:${String(port)}\r\n` +
        `Upgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${crypto.randomBytes(16).toString('base64')}\r\n` +
        `Sec-WebSocket-Version: 13\r\nOrigin: ${APP}\r\n\r\n`,
    );
    await new Promise((resolve) => raw.once('data', resolve));

    // FIN + text, masked, two bytes that are not a UTF-8 sequence.
    const mask = Buffer.from([0x01, 0x02, 0x03, 0x04]);
    const payload = Buffer.from([0xff, 0xfe]);
    raw.write(
      Buffer.concat([
        Buffer.from([0x81, 0x82]),
        mask,
        Buffer.from(payload.map((byte, at) => byte ^ (mask[at % 4] as number))),
      ]),
    );
    await new Promise((resolve) => setTimeout(resolve, 200));

    process.off('uncaughtException', caught);
    expect(escaped.map((error) => error.message)).toEqual([]);

    // And it is still there, still letting somebody in.
    const client = await open(port, `/ws/${ROOM}/Ada`, { origin: APP });
    await until(
      () => service?.connections.holds(ROOM, 'Ada') === true,
      'the service to accept a socket after the malformed frame',
    );
    client.close();
    raw.destroy();
  });
});

describe('O.2 — a socket that closes while it is still joining', () => {
  /**
   * The criterion. Before the fix the `close` handler was registered after four
   * awaits, so this close reached nobody: the registry held Ada for the life of
   * the process, her own reconnection was refused `name_taken`, and the roster
   * kept a player who would never be ready — a round that never starts.
   *
   * Thirty milliseconds a call is a hosted Redis, not a slow one.
   */
  it('is forgotten by the registry', async () => {
    const port = await start(30);

    const socket = new WebSocket(`ws://127.0.0.1:${String(port)}/ws/${ROOM}/Ada`, {
      headers: { origin: APP },
    });
    socket.on('error', () => undefined);
    await new Promise((resolve) => socket.on('open', resolve));
    socket.close();

    await until(() => service?.connections.holds(ROOM, 'Ada') === false, {
      want: 'the registry to forget Ada',
      saw: () => `a registry of ${String(service?.connections.size)}`,
    });
    expect(service?.connections.size).toBe(0);
  });

  /**
   * And the seat is hers again, which is the half a player would notice.
   *
   * **With her token**, the way a real client reconnects: D5 binds a slot to a
   * secret the browser keeps for the life of its tab, and a connection that
   * brings none is deliberately unable to reclaim anything — `tokens.ts` stores
   * a value no client can ever present, and that is a rule rather than a
   * casualty of this bug.
   *
   * What was broken is upstream of the token: `connections.holds` is consulted
   * *before* the claim, so a ghost in the registry refused her on a question
   * her token never got to answer.
   */
  it('leaves the nickname reclaimable by its owner', async () => {
    const port = await start(30);
    const token = 'a-session-token-the-tab-keeps';
    const path = `/ws/${ROOM}/Ada?token=${token}`;

    const first = new WebSocket(`ws://127.0.0.1:${String(port)}${path}`, {
      headers: { origin: APP },
    });
    first.on('error', () => undefined);
    await new Promise((resolve) => first.on('open', resolve));
    first.close();
    await until(
      () => service?.connections.holds(ROOM, 'Ada') === false,
      'the first socket to be forgotten',
    );

    const again = await open(port, path, { origin: APP });
    await until(
      () => service?.connections.holds(ROOM, 'Ada') === true,
      'Ada to hold her own nickname again',
    );
    expect(
      again.received.filter((message) => (message as { type?: string }).type === 'error'),
    ).toEqual([]);
    again.close();
  });
});

const url = testRedisUrl();

describe.skipIf(url === null)('O.3 — a Redis connection that dropped', () => {
  /** Cuts every client but its own, the way a restart or an idle reaper does. */
  const killEveryoneElse = async (): Promise<void> => {
    const { createClient } = await import('redis');
    const admin = await createClient({ url: url as string })
      .on('error', () => undefined)
      .connect();
    await admin.sendCommand(['CLIENT', 'KILL', 'TYPE', 'normal', 'SKIPME', 'yes']);
    await admin.sendCommand(['CLIENT', 'KILL', 'TYPE', 'pubsub', 'SKIPME', 'yes']);
    await admin.quit();
    await new Promise((resolve) => setTimeout(resolve, 200));
  };

  /**
   * The criterion for the room's own store.
   *
   * Before the fix the memo was cleared only when the *first* connect rejected,
   * so a connection that succeeded and then dropped left a client that was
   * closed for ever: every call rejected with *the client is closed*, and the
   * instance answered "the room could not be reached" to players sitting in a
   * room until it restarted.
   */
  it('is reopened by the next call', async () => {
    const port = lazyRedis(url as string);
    expect(await port.hmGet('wikifake:test:availability:absent', ['revision'])).toEqual([
      null,
    ]);

    await killEveryoneElse();

    // The recovery this function has always promised: the next call opens a
    // fresh connection rather than handing back the dead one.
    await until(async () => {
      try {
        await port.hmGet('wikifake:test:availability:absent', ['revision']);
        return true;
      } catch {
        return false;
      }
    }, 'the store to reopen its connection');
  });

  /**
   * And the bus, which needs more than the room does: a subscription does not
   * survive its connection, so a listener that reopened without re-subscribing
   * would leave the rooms it serves connected and deaf — worse than the error
   * the publisher raises, because nothing anywhere says so.
   */
  it('reopens the bus, and re-subscribes what it was holding', async () => {
    const bus = createRedisBus(url as string);
    const channel = 'wikifake:test:availability:channel';
    const heard: string[] = [];

    await bus.subscribe(channel, (payload) => heard.push(payload));
    await bus.publish(channel, 'before');
    await until(
      () => heard.includes('before'),
      'the subscriber to hear the first message',
    );

    await killEveryoneElse();

    // Publishing is what reopens the publisher; the first attempt after a drop
    // may still reject on the dead client, which is the documented contract —
    // *the next call opens a fresh one*.
    await until(async () => {
      try {
        await bus.publish(channel, 'after');
      } catch {
        return false;
      }
      return heard.includes('after');
    }, 'the bus to reopen and re-subscribe');

    await bus.close();
  });
});

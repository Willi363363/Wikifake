// 5.3's criteria: two instances talking over the same room, and a deliberately
// blocked socket that does not delay delivery to the other players.
//
// Two services on two ports, one Redis between them. That is the whole point of
// the step and the reason it cannot be tested any other way: state creeping back
// into process memory only shows up with several instances, which is what the
// phase's fourth pitfall says.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createRedisBus, type Bus } from './bus.js';
import { createOriginPolicy } from './origins.js';
import { stubArticles } from './testing/articles.js';
import { createLocalScheduler } from './timers/local.js';
import { createLocalTokens } from './rooms/tokens.js';
import { createRoomStore } from './rooms/store.js';
import { createService, type Service } from './server.js';
import { open, until, type Opened } from './testing/client.js';
import { openTestRedis, testRedisUrl, type TestRedis } from './testing/redis.js';

const url = testRedisUrl();
const NAMESPACE = 'wikifake:test:broadcast';

/** A room of its own per test: a stray `leave` must not blank the next one. */
let rooms = 0;
const nextRoom = (): string => `B${String(++rooms).padStart(5, '0')}`;

interface Lobby {
  readonly type: string;
  readonly players: { name: string; ready: boolean; isHost: boolean }[];
}

describe.skipIf(url === null)('5.3 — one room, several instances', () => {
  let redis: TestRedis;
  let buses: Bus[];
  let services: Service[];
  let ports: number[];
  let ROOM: string;

  beforeAll(async () => {
    redis = await openTestRedis(url as string, NAMESPACE);
  });
  afterAll(async () => {
    await redis.close();
  });

  /** A service with its own bus connections — as separate as two processes. */
  async function instance(budgetBytes?: number): Promise<number> {
    const bus = createRedisBus(url as string);
    buses.push(bus);

    const service = createService({
      origins: createOriginPolicy(['https://wikifake.example']),
      roomExists: () => Promise.resolve(true),
      // 5.7 — nothing in this file is about the row: the room's own state is
      // what it watches.
      closeRoom: () => Promise.resolve(),
      rooms: createRoomStore({ redis: redis.redis, namespace: NAMESPACE }),
      bus,
      tokens: createLocalTokens(),
      // 5.8 — the article pipeline, mocked. Nothing here is about a round.
      articles: stubArticles(),
      // D5 — a dropped socket is a departure only once the window has run.
      // Shortened so a test can watch it happen rather than wait for it.
      graceSeconds: 0.05,
      namespace: NAMESPACE,
      scheduler: createLocalScheduler,
      ...(budgetBytes === undefined ? {} : { budgetBytes }),
    });
    services.push(service);

    const port = await service.listen(0);
    ports.push(port);
    return port;
  }

  beforeEach(async () => {
    await redis.flush();
    ROOM = nextRoom();
    buses = [];
    services = [];
    ports = [];
  });

  afterEach(async () => {
    for (const service of services) await service.close();
    for (const bus of buses) await bus.close();
  });

  const join = (port: number, name: string): Promise<Opened> =>
    open(port, `/ws/${ROOM}/${encodeURIComponent(name)}`);

  const lastLobby = (client: Opened): Lobby | undefined =>
    client.received
      .filter((message): message is Lobby => (message as Lobby).type === 'lobby_update')
      .at(-1);

  const roster = (client: Opened): string[] =>
    (lastLobby(client)?.players ?? []).map((player) => player.name);

  const rosterOf = (client: Opened, names: string[]): Promise<void> =>
    until(
      () =>
        JSON.stringify([...roster(client)].sort()) === JSON.stringify([...names].sort()),
      `the lobby to hold ${names.join(', ')}`,
    );

  // The criterion. Ada is on one instance, Bob on another, and neither is on the
  // instance the other's messages were decided by.
  it('serves one room from two instances', async () => {
    const first = await instance();
    const second = await instance();
    expect(first).not.toBe(second);

    const ada = await join(first, 'ada');
    await rosterOf(ada, ['ada']);

    const bob = await join(second, 'bob');

    // Both see both, and neither had to be on the other's process.
    await rosterOf(ada, ['ada', 'bob']);
    await rosterOf(bob, ['ada', 'bob']);

    ada.close();
    bob.close();
  });

  it('carries a message decided on one instance to a socket on the other', async () => {
    const first = await instance();
    const second = await instance();

    const ada = await join(first, 'ada');
    const bob = await join(second, 'bob');
    await rosterOf(ada, ['ada', 'bob']);

    bob.send({ type: 'set_ready', ready: true });
    await until(
      () =>
        lastLobby(ada)?.players.find((player) => player.name === 'bob')?.ready === true,
      'bob’s ready to reach ada',
    );

    expect(lastLobby(ada)?.players.find((player) => player.name === 'ada')?.ready).toBe(
      false,
    );
    ada.close();
    bob.close();
  });

  it('tells the other instance when a player is evicted', async () => {
    const first = await instance();
    const second = await instance();

    const ada = await join(first, 'ada');
    const bob = await join(second, 'bob');
    await rosterOf(bob, ['ada', 'bob']);

    ada.close();
    await rosterOf(bob, ['bob']);

    // C1.8 — and the host role moves with the departure, decided once, in Redis.
    expect(lastLobby(bob)?.players[0]?.isHost).toBe(true);
    bob.close();
  });

  // C5.2 — the homonym check is per instance until 5.5 gives a player an
  // identity. This pins what that means today rather than leaving it to be
  // discovered: a second Ada on another instance gets in, and the room says so.
  it('does not yet refuse a homonym arriving on another instance', async () => {
    const first = await instance();
    const second = await instance();

    const ada = await join(first, 'ada');
    await rosterOf(ada, ['ada']);

    const impostor = await join(second, 'ada');
    expect(impostor.closedWith()).toBeUndefined();

    // The rules keep one player per nickname, so the room is not doubled — what
    // is missing is the refusal, not the state.
    await rosterOf(ada, ['ada']);
    ada.close();
    impostor.close();
  });

  describe('the criterion — a blocked socket', () => {
    // `send` appends to a buffer and returns, so a stalled reader never delays
    // anybody. What it does is grow that buffer without bound, which is why the
    // budget exists — and the budget is what this test drives.
    it('does not delay the players who are reading', async () => {
      const port = await instance();

      const ada = await join(port, 'ada');
      const bob = await join(port, 'bob');
      await rosterOf(ada, ['ada', 'bob']);

      // Bob stops reading. His socket is still open; nothing is being taken off
      // it, so everything sent to him queues.
      bob.pause();

      const before = ada.received.length;
      ada.send({ type: 'set_ready', ready: true });

      // Ada's message goes through the rules, over Redis, and back to Ada while
      // Bob's socket is stalled. The default two-second wait is the deadline.
      await until(() => ada.received.length > before, 'ada’s own update');
      expect(lastLobby(ada)?.players.find((player) => player.name === 'ada')?.ready).toBe(
        true,
      );

      bob.resume();
      ada.close();
      bob.close();
    });

    // The eviction rule itself is in `effects.test.ts`, against connections whose
    // buffer a test can set. It is not driven through a real socket here on
    // purpose: the kernel's own send buffer absorbs tens of kilobytes before
    // `bufferedAmount` moves at all, so provoking it would mean pushing megabytes
    // of lobby updates through a suite — slow, and flaky on a busy machine, to
    // prove a comparison.
  });
});

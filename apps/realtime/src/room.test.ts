// The transport and the room, together, over real sockets and a real Redis.
//
// `store.test.ts` proves the state survives concurrency; `server.test.ts` proves
// the transport refuses what it should. This proves the two are joined up: a
// socket opening is a `join` the rules decided on, and what the rules decided
// reaches the other players.
//
// Delivery here is **to the sockets this instance holds**. That is the naive
// version on purpose — it is what a single-instance deployment needs, and step
// 5.3 replaces it with a Redis channel per room so any instance serves any
// socket. Until then a room split across two instances hears half of itself,
// which the last test in this file pins so the gap is a fact rather than a
// surprise.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createLocalBus } from './bus.js';
import { createOriginPolicy } from './origins.js';
import { createLocalScheduler } from './timers/local.js';
import { createLocalTokens } from './rooms/tokens.js';
import { createRoomStore } from './rooms/store.js';
import { createService, type Service } from './server.js';
import { open, until, type Opened } from './testing/client.js';
import { openTestRedis, testRedisUrl, type TestRedis } from './testing/redis.js';
import { stubArticles, type StubSource } from './testing/articles.js';

const url = testRedisUrl();
const NAMESPACE = 'wikifake:test:room';

/**
 * A room of its own per test.
 *
 * Closing a socket settles a `leave` that nobody awaits — which is right, since
 * nothing should wait on a departed player — so a leave from the previous test
 * can land after the next one has started. Sharing a room code let that stray
 * write blank a room a test had just filled, and the failure looked like a lost
 * join rather than like leakage between tests.
 */
let rooms = 0;
const nextRoom = (): string => `R${String(++rooms).padStart(5, '0')}`;

interface Lobby {
  readonly type: string;
  readonly players: { name: string; ready: boolean; isHost: boolean }[];
}

describe.skipIf(url === null)('5.2 — a room over sockets', () => {
  let redis: TestRedis;
  let service: Service;
  let port: number;
  let articles: StubSource;
  let ROOM: string;

  beforeAll(async () => {
    redis = await openTestRedis(url as string, NAMESPACE);
  });
  afterAll(async () => {
    await redis.close();
  });

  beforeEach(async () => {
    await redis.flush();
    ROOM = nextRoom();
    articles = stubArticles();
    service = createService({
      origins: createOriginPolicy(['https://wikifake.example']),
      roomExists: () => Promise.resolve(true),
      // 5.7 — nothing in this file is about the row: the room's own state is
      // what it watches.
      closeRoom: () => Promise.resolve(),
      rooms: createRoomStore({ redis: redis.redis, namespace: NAMESPACE }),
      // One instance, so the channel need not leave the process. Crossing
      // instances is `broadcast.test.ts`, over a real Redis.
      bus: createLocalBus(),
      tokens: createLocalTokens(),
      // D5 — a dropped socket is a departure only once the window has run.
      // Shortened so a test can watch it happen rather than wait for it.
      graceSeconds: 0.05,
      // Not about surviving a redeployment: `timers.test.ts` is.
      scheduler: createLocalScheduler,
      namespace: NAMESPACE,
      // 5.8 — the pipeline, with the model and Wikipedia mocked. Before it, a
      // room could pick a topic and no round ever began.
      articles,
    });
    port = await service.listen(0);
  });

  afterEach(async () => {
    await service.close();
  });

  const join = (name: string, room = ROOM): Promise<Opened> =>
    open(port, `/ws/${room}/${encodeURIComponent(name)}`);

  const lobbies = (client: Opened): Lobby[] =>
    client.received.filter(
      (message): message is Lobby => (message as Lobby).type === 'lobby_update',
    );

  const lastLobby = (client: Opened): Lobby | undefined => lobbies(client).at(-1);

  const roster = (client: Opened): string[] =>
    (lastLobby(client)?.players ?? []).map((player) => player.name);

  /**
   * Waits until this client's latest lobby holds exactly these players.
   *
   * Counting lobbies would not do: a socket is registered before its own `join`
   * is committed — which is what keeps two homonyms racing from both getting in
   * — so it receives the broadcast of somebody else's join first, and that
   * lobby does not include it yet.
   */
  const rosterOf = (client: Opened, names: string[]): Promise<void> =>
    until(
      () =>
        JSON.stringify([...roster(client)].sort()) === JSON.stringify([...names].sort()),
      `${client === undefined ? 'a client' : 'the lobby'} to hold ${names.join(', ')}`,
    );

  it('tells a player who is in the room the moment they arrive', async () => {
    const ada = await join('ada');
    await rosterOf(ada, ['ada']);

    expect(roster(ada)).toEqual(['ada']);
    // C1.8 by construction: the first to arrive is the host.
    expect(lastLobby(ada)?.players[0]?.isHost).toBe(true);
    ada.close();
  });

  it('tells the players already there that somebody joined', async () => {
    const ada = await join('ada');
    await rosterOf(ada, ['ada']);

    const bob = await join('bob');
    await rosterOf(ada, ['ada', 'bob']);
    await rosterOf(bob, ['ada', 'bob']);

    expect(roster(ada)).toEqual(['ada', 'bob']);
    expect(roster(bob)).toEqual(['ada', 'bob']);
    ada.close();
    bob.close();
  });

  it('carries a message through the rules and back to the room', async () => {
    const ada = await join('ada');
    const bob = await join('bob');
    await rosterOf(ada, ['ada', 'bob']);

    bob.send({ type: 'set_ready', ready: true });
    await until(
      () => lastLobby(ada)?.players.some((player) => player.ready) === true,
      'the ready to come back',
    );

    const seen = lastLobby(ada)?.players ?? [];
    expect(seen.find((player) => player.name === 'bob')?.ready).toBe(true);
    expect(seen.find((player) => player.name === 'ada')?.ready).toBe(false);
    ada.close();
    bob.close();
  });

  // Nothing about the room is kept between frames, so the state a second
  // instance would read is the state this one is acting on.
  it('leaves the whole room in Redis and nothing in the process', async () => {
    const ada = await join('ada');
    const bob = await join('bob');
    await rosterOf(bob, ['ada', 'bob']);

    const held = await createRoomStore({
      redis: redis.redis,
      namespace: NAMESPACE,
    }).read(ROOM);

    expect(held.state.players.map((player) => player.name)).toEqual(['ada', 'bob']);
    expect(held.revision).toBeGreaterThanOrEqual(2);
    ada.close();
    bob.close();
  });

  it('promotes the next player once the host is evicted', async () => {
    const ada = await join('ada');
    const bob = await join('bob');
    await rosterOf(bob, ['ada', 'bob']);

    ada.close();
    await rosterOf(bob, ['bob']);

    expect(lastLobby(bob)?.players[0]?.isHost).toBe(true);
    bob.close();
  });

  it('forgets the room once its last player is evicted', async () => {
    const ada = await join('ada');
    await rosterOf(ada, ['ada']);

    const store = createRoomStore({ redis: redis.redis, namespace: NAMESPACE });
    expect((await store.read(ROOM)).revision).toBe(1);

    ada.close();

    // Polled rather than awaited: nothing should wait on a player who has gone,
    // so the leave is settled without anybody holding a promise for it.
    let held = await store.read(ROOM);
    const deadline = Date.now() + 2000;
    while (held.revision !== 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      held = await store.read(ROOM);
    }

    expect(held.revision).toBe(0);
    expect(held.state.players).toEqual([]);
  });

  // The gap this step leaves, pinned rather than left to be discovered: the
  // effects that need the article pipeline or BullMQ have nowhere to go yet.
  it('hands on the effects it cannot carry, rather than dropping them', async () => {
    const ada = await join('ada');
    const bob = await join('bob');
    await rosterOf(ada, ['ada', 'bob']);

    // Both ready: the host may start, which asks for an article.
    ada.send({ type: 'set_ready', ready: true });
    bob.send({ type: 'set_ready', ready: true });
    await until(
      () => (lastLobby(ada)?.players.filter((player) => player.ready).length ?? 0) === 2,
      'both to be ready',
    );

    ada.send({ type: 'force_start' });
    ada.send({ type: 'submit_theme', topic: 'Chat' });
    ada.send({ type: 'force_pick' });

    await until(() => articles.asked.length > 0, 'the article to be asked for');

    expect(articles.asked[0]).toMatchObject({ roomCode: ROOM, topic: 'Chat' });
    ada.close();
    bob.close();
  });
});

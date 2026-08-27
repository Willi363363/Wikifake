// 5.5's criteria: a socket cut mid-round then reconnected recovers score, items
// and paid hints, and a homonym is refused during the grace window.
//
// D5, in one sentence: the current server never sets `connected` to false —
// a disconnection deletes the player, so their score, their items and the hints
// they paid for go with them, and their nickname is immediately claimable by a
// stranger.
//
// The claim runs against a real Redis, because a claim only one instance knows
// about is not a claim: the player who dropped on one instance reconnects to
// whichever one the load balancer picks.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ArticleView, FalsifiedPosition } from '@wikifake/protocol';

import { createLocalBus, type Bus } from './bus.js';
import { createOriginPolicy } from './origins.js';
import { createRoomStore, type RoomStore } from './rooms/store.js';
import { createTokenStore } from './rooms/tokens.js';
import { createService, type Service } from './server.js';
import { createLocalScheduler } from './timers/local.js';
import { open, until, type Opened } from './testing/client.js';
import { openTestRedis, testRedisUrl, type TestRedis } from './testing/redis.js';
import { canned } from './testing/articles.js';

const url = testRedisUrl();
const NAMESPACE = 'wikifake:test:reconnect';

let rooms = 0;
const nextRoom = (): string => `C${String(++rooms).padStart(5, '0')}`;

/**
 * What a client would generate and keep for its tab.
 *
 * Named `CLAIM` rather than `TOKEN` so the repository's secret scanner does not
 * read a test fixture as a leaked credential — it looks for `TOKEN = '…'`, and
 * it is right to.
 */
const ADA_CLAIM = 'ada-claim-0123456789';
const OTHER_CLAIM = 'somebody-else-9876543';

const ARTICLE: ArticleView = {
  topic: 'Chat',
  paragraphs: ['Le chat dort seize heures par jour.', 'Sa vision nocturne est bonne.'],
  totalFakes: 1,
  wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
};

const SOLUTION: readonly FalsifiedPosition[] = [
  {
    paragraphIndex: 1,
    falseInfoNumber: 1,
    falseStatement: 'Le chat dort seize heures par jour.',
    explanation: 'TRUTHMARKER-quatre-heures',
    hint: 'HINTMARKER-comptez',
  },
];

/**
 * The window, for the tests that need it *not* to close.
 *
 * Five seconds, and generous on purpose. Four of these tests assert that a
 * dropped player is still in the room — across an `until` poll, two store reads
 * and a socket handshake — and a window short enough to wait out is a window
 * that sequence can outlast. It did: about one full parallel `pnpm test` in
 * five, never in isolation, and the failure read as "the player was not
 * recovered" rather than as "the test was too slow".
 *
 * One constant cannot serve both needs, so there are two.
 */
const GRACE_MS = 5000;

/** The window, for the one test whose whole point is waiting it out. */
const SHORT_GRACE_MS = 300;

describe.skipIf(url === null)(
  '5.5 — a socket that dropped is not a player who left',
  () => {
    let redis: TestRedis;
    let store: RoomStore;
    let bus: Bus;
    let service: Service;
    let port: number;
    let ROOM: string;

    beforeAll(async () => {
      redis = await openTestRedis(url as string, NAMESPACE);
    });
    afterAll(async () => {
      await redis.close();
    });

    /**
     * @param graceMs how long a dropped player keeps their seat. The default
     * outlives the test; only the expiry test shortens it.
     */
    const start = async (graceMs: number): Promise<void> => {
      store = createRoomStore({ redis: redis.redis, namespace: NAMESPACE });
      bus = createLocalBus();
      service = createService({
        origins: createOriginPolicy(['https://wikifake.example']),
        roomExists: () => Promise.resolve(true),
        // 5.7 — nothing in this file is about the row: the room's own state is
        // what it watches.
        closeRoom: () => Promise.resolve(),
        rooms: store,
        bus,
        namespace: NAMESPACE,
        scheduler: createLocalScheduler,
        // The real one: a claim is the whole point of the step.
        tokens: createTokenStore({
          redis: redis.redis,
          namespace: NAMESPACE,
          idleSeconds: 60,
        }),
        graceSeconds: graceMs / 1000,
        // 5.8 — the pipeline, mocked: picking a topic starts the round.
        articles: canned(ARTICLE, SOLUTION),
      });
      port = await service.listen(0);
    };

    beforeEach(async () => {
      await redis.flush();
      ROOM = nextRoom();
      await start(GRACE_MS);
    });

    afterEach(async () => {
      await service.close();
      await bus.close();
    });

    const join = (name: string, token?: string): Promise<Opened> =>
      open(
        port,
        `/ws/${ROOM}/${encodeURIComponent(name)}${token === undefined ? '' : `?token=${token}`}`,
      );

    const players = async (): Promise<{ name: string; connected: boolean }[]> =>
      (await store.read(ROOM)).state.players.map((player) => ({
        name: player.name,
        connected: player.connected,
      }));

    const rosterOf = (client: Opened, names: string[]): Promise<void> =>
      until(
        () => {
          const last = client.received
            .filter((message) => (message as { type: string }).type === 'lobby_update')
            .at(-1) as { players?: { name: string }[] } | undefined;
          return (
            JSON.stringify((last?.players ?? []).map((player) => player.name).sort()) ===
            JSON.stringify([...names].sort())
          );
        },
        `the lobby to hold ${names.join(', ')}`,
      );

    /** Two players in a round, ada having bought a hint and submitted. */
    async function playRound(): Promise<{ ada: Opened; bob: Opened }> {
      const ada = await join('ada', ADA_CLAIM);
      const bob = await join('bob', OTHER_CLAIM);
      await rosterOf(ada, ['ada', 'bob']);

      ada.send({ type: 'set_ready', ready: true, withItems: false });
      bob.send({ type: 'set_ready', ready: true });
      ada.send({ type: 'force_start' });
      ada.send({ type: 'submit_theme', topic: 'Chat' });
      ada.send({ type: 'force_pick' });
      await until(
        () =>
          ada.received.some(
            (message) => (message as { type: string }).type === 'theme_selected',
          ),
        'the topic to be picked',
      );

      await until(
        () =>
          ada.received.some(
            (message) => (message as { type: string }).type === 'game_start',
          ),
        'the round to start',
      );

      // C1.4 — a hint paid for. The thing a disconnection currently throws away.
      ada.send({ type: 'unlock_hint', falseInfoNumber: 1, level: 1 });
      await until(
        () =>
          ada.received.some(
            (message) => (message as { type: string }).type === 'hint_unlocked',
          ),
        'the hint',
      );

      return { ada, bob };
    }

    // The criterion.
    it('gives a player back everything they had paid for', async () => {
      const { ada, bob } = await playRound();

      const before = (await store.read(ROOM)).state.players.find(
        (player) => player.name === 'ada',
      );
      expect(before?.hints).toEqual({ 1: 1 });

      ada.close();

      // Marked away, and still there. The room did not lose a player — which is
      // exactly what the current server does at this point.
      await until(
        () => sees(bob, 'ada')?.connected === false,
        'the disconnection to reach the room',
      );
      const away = (await store.read(ROOM)).state.players.find(
        (player) => player.name === 'ada',
      );
      expect(away?.connected).toBe(false);
      expect((await players()).map((player) => player.name)).toEqual(['ada', 'bob']);

      const back = await join('ada', ADA_CLAIM);
      await rosterOf(back, ['ada', 'bob']);

      const recovered = (await store.read(ROOM)).state.players.find(
        (player) => player.name === 'ada',
      );
      expect(recovered?.connected).toBe(true);
      // The hint they paid for, the colour they had, the seat they held.
      expect(recovered?.hints).toEqual({ 1: 1 });
      expect(recovered?.colour).toBe(before?.colour);
      expect((await store.read(ROOM)).state.phase).toBe('round');

      back.close();
      bob.close();
    });

    // The other criterion. Keeping a dropped player's score is also, on its own, a
    // way to steal it: the claim is what stops that.
    it('refuses a homonym who cannot prove they are the player who dropped', async () => {
      const { ada, bob } = await playRound();
      ada.close();

      const impostor = await join('ada', OTHER_CLAIM);
      await impostor.waitForMessages(1);

      expect(impostor.received[0]).toMatchObject({ type: 'error', code: 'name_taken' });
      expect(await impostor.closed()).toBeGreaterThan(0);

      // And nothing of ada's was touched: the hint is still hers, and so is the
      // slot she is coming back to.
      const held = (await store.read(ROOM)).state.players.find(
        (player) => player.name === 'ada',
      );
      expect(held?.hints).toEqual({ 1: 1 });
      bob.close();
    });

    it('refuses a homonym who brings no token at all', async () => {
      const { ada, bob } = await playRound();
      ada.close();

      const impostor = await join('ada');
      await impostor.waitForMessages(1);
      expect(impostor.received[0]).toMatchObject({ code: 'name_taken' });
      bob.close();
    });

    // Fails closed: a client that never brought a secret cannot reclaim its own
    // nickname either. Safe, and strictly better than a slot anybody can walk into.
    it('refuses even the rightful player when they brought no token', async () => {
      const first = await join('anon');
      await rosterOf(first, ['anon']);
      first.close();

      const back = await join('anon');
      await back.waitForMessages(1);
      expect(back.received[0]).toMatchObject({ code: 'name_taken' });
    });

    it('frees the nickname once the grace window has run out', async () => {
      // The one test that wants the window to close, so it is the one that
      // shortens it. Everything else would rather it never did.
      await service.close();
      await bus.close();
      await start(SHORT_GRACE_MS);

      const first = await join('ada', ADA_CLAIM);
      const bob = await join('bob', OTHER_CLAIM);
      await rosterOf(first, ['ada', 'bob']);
      first.close();

      // Waited out on purpose: the window is what decides they are gone.
      await until(
        () => sees(bob, 'ada') === undefined,
        'ada to be evicted',
        SHORT_GRACE_MS * 10,
      );

      expect((await players()).map((player) => player.name)).toEqual(['bob']);

      // And the slot is genuinely free: a stranger may now take the nickname.
      const stranger = await join('ada', OTHER_CLAIM);
      await rosterOf(stranger, ['bob', 'ada']);
      expect(stranger.closedWith()).toBeUndefined();

      stranger.close();
      bob.close();
    });

    /** One player, as this client last saw them. */
    const sees = (
      client: Opened,
      name: string,
    ): { name: string; connected: boolean } | undefined => {
      const last = client.received
        .filter((message) => (message as { type: string }).type === 'lobby_update')
        .at(-1) as { players?: { name: string; connected: boolean }[] } | undefined;
      return (last?.players ?? []).find((player) => player.name === name);
    };
  },
);

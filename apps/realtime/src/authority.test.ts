// 5.7's criteria, over real sockets: who is allowed to decide, and what ends a
// room.
//
// C1.7 and C1.8 are rules, and phase 1 wrote them. What this file adds is that
// they are enforced *from a socket* — and, for the refusals, that a refused
// message leaves the room exactly as it was. "Refused" is easy to satisfy by
// answering an error after doing the thing anyway, which is what the current
// server does with `force_start`: it applies the options, then checks the host.
//
// The end of a room is the part that is genuinely new here. Redis forgets the
// state on its own; the row that says the code exists is forgotten by the
// service, on both ends of a room's life (C1.8, D4).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ArticleView, FalsifiedPosition } from '@wikifake/protocol';

import { createLocalBus, type Bus } from './bus.js';
import { createOriginPolicy } from './origins.js';
import { createRoomStore, roomKey, type RoomStore } from './rooms/store.js';
import { createLocalTokens } from './rooms/tokens.js';
import { createService, type Service, type ServiceOptions } from './server.js';
import { createLocalScheduler } from './timers/local.js';
import { open, until, type Opened } from './testing/client.js';
import { openTestRedis, testRedisUrl, type TestRedis } from './testing/redis.js';

const url = testRedisUrl();
const NAMESPACE = 'wikifake:test:authority';

let rooms = 0;
const nextRoom = (): string => `A${String(++rooms).padStart(5, '0')}`;

const TIME_LIMIT = 120;
/** Long enough not to race a test, short enough to wait out on purpose. */
const GRACE_SECONDS = 0.05;

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

type Message = { readonly type: string } & Record<string, unknown>;
type Roster = { name: string; ready: boolean; isHost: boolean }[];

const of = (client: Opened, type: string): Message[] =>
  (client.received as Message[]).filter((message) => message.type === type);

const roster = (client: Opened): Roster =>
  (of(client, 'lobby_update').at(-1)?.['players'] as Roster | undefined) ?? [];

describe.skipIf(url === null)('5.7 — who decides, and what ends a room', () => {
  let redis: TestRedis;
  let store: RoomStore;
  let bus: Bus;
  let service: Service;
  let port: number;
  let ROOM: string;
  let forgotten: string[];

  beforeAll(async () => {
    redis = await openTestRedis(url as string, NAMESPACE);
  });
  afterAll(async () => {
    await redis.close();
  });

  const start = async (overrides: Partial<ServiceOptions> = {}): Promise<void> => {
    service = createService({
      origins: createOriginPolicy(['https://wikifake.example']),
      roomExists: () => Promise.resolve(true),
      closeRoom: (roomCode) => {
        forgotten.push(roomCode);
        return Promise.resolve();
      },
      rooms: store,
      bus,
      namespace: NAMESPACE,
      scheduler: createLocalScheduler,
      tokens: createLocalTokens(),
      graceSeconds: GRACE_SECONDS,
      ...overrides,
    });
    port = await service.listen(0);
  };

  beforeEach(async () => {
    await redis.flush();
    ROOM = nextRoom();
    forgotten = [];
    store = createRoomStore({ redis: redis.redis, namespace: NAMESPACE });
    bus = createLocalBus();
    await start();
  });

  afterEach(async () => {
    await service.close();
    await bus.close();
  });

  const join = (name: string): Promise<Opened> =>
    open(port, `/ws/${ROOM}/${encodeURIComponent(name)}`);

  const seen = (client: Opened, type: string, count = 1): Promise<void> =>
    until(
      () => of(client, type).length >= count,
      () => `${String(count)} ${type}, got ${String(of(client, type).length)}`,
    );

  const held = async (): Promise<{
    phase: string;
    options: { withItems: boolean; timeLimit: number };
  }> => {
    const room = (await store.read(ROOM)).state;
    return { phase: room.phase, options: room.options };
  };

  /** Two players, ada hosting, on a chosen time limit. */
  async function lobby(): Promise<{ ada: Opened; bob: Opened }> {
    const ada = await join('ada');
    const bob = await join('bob');

    ada.send({ type: 'set_ready', ready: true, withItems: false, timeLimit: TIME_LIMIT });
    bob.send({ type: 'set_ready', ready: true });
    await until(
      () => roster(bob).length === 2 && roster(bob).every((player) => player.ready),
      () => `both ready, saw ${JSON.stringify(roster(bob))}`,
    );

    return { ada, bob };
  }

  describe('C1.7 — the host decides, and a refusal decides nothing', () => {
    it('refuses force_start to a guest without touching the room', async () => {
      const { ada, bob } = await lobby();

      // The options it carries are the trap: the current handler applies them
      // and then checks who sent it.
      bob.send({ type: 'force_start', withItems: true, timeLimit: 300 });
      await seen(bob, 'error');

      expect(of(bob, 'error')[0]).toMatchObject({ code: 'not_host' });
      expect(await held()).toEqual({
        phase: 'lobby',
        options: { withItems: false, timeLimit: TIME_LIMIT },
      });

      ada.close();
      bob.close();
    });

    it('refuses start_game to a guest without starting anything', async () => {
      const { ada, bob } = await lobby();

      bob.send({ type: 'start_game', topic: 'Chat', timeLimit: 300 });
      await seen(bob, 'error');

      expect(of(bob, 'error')[0]).toMatchObject({ code: 'not_host' });
      expect(await held()).toEqual({
        phase: 'lobby',
        options: { withItems: false, timeLimit: TIME_LIMIT },
      });

      ada.close();
      bob.close();
    });

    it('refuses force_pick to a guest and leaves the vote open', async () => {
      const { ada, bob } = await lobby();
      ada.send({ type: 'force_start' });
      await seen(bob, 'theme_vote_start');

      bob.send({ type: 'submit_theme', topic: 'Chat' });
      await seen(bob, 'theme_vote_update');
      bob.send({ type: 'force_pick' });
      await seen(bob, 'error');

      expect(of(bob, 'error')[0]).toMatchObject({ code: 'not_host' });
      expect((await held()).phase).toBe('voting');
      expect(of(bob, 'theme_selected')).toHaveLength(0);

      ada.close();
      bob.close();
    });

    // A guest's `set_ready` carries the options too — the client attaches them
    // every time — so they are dropped rather than refused: their own `ready` is
    // legitimate, and an error to every guest's ready would be noise.
    it('takes a guest ready and drops the options riding with it', async () => {
      const { ada, bob } = await lobby();

      bob.send({ type: 'set_ready', ready: false, withItems: true, timeLimit: 300 });
      await until(
        () => roster(bob).find((player) => player.name === 'bob')?.ready === false,
        'bob to be un-ready',
      );

      expect((await held()).options).toEqual({
        withItems: false,
        timeLimit: TIME_LIMIT,
      });
      expect(of(bob, 'error')).toHaveLength(0);

      ada.close();
      bob.close();
    });

    // C1.8 — the host is whoever is first, so removing them promotes the next by
    // arithmetic. No transition, and nothing to forget.
    it('promotes the next player when the host is gone', async () => {
      const { ada, bob } = await lobby();
      expect(roster(bob).find((player) => player.name === 'ada')?.isHost).toBe(true);

      ada.close();

      await until(
        () => roster(bob).length === 1,
        () => `ada to be evicted, saw ${JSON.stringify(roster(bob))}`,
      );
      expect(roster(bob)[0]).toMatchObject({ name: 'bob', isHost: true });

      bob.close();
    });
  });

  describe('C1.8, D4 — the room ends', () => {
    it('forgets the state and the row when the last player is evicted', async () => {
      const ada = await join('ada');
      await seen(ada, 'lobby_update');

      ada.close();

      await until(() => forgotten.includes(ROOM), 'the room to be forgotten');
      // Both halves: Redis holds what is happening in the room, Postgres holds
      // that it exists at all, and a room that ends has to leave neither behind.
      expect(await redis.client.exists(roomKey(NAMESPACE, ROOM))).toBe(0);
    });

    // The other end of a room's life, and the one nothing decides: an idle room
    // has no last player to evict, so without this its row lives for ever.
    it('forgets the row of a room nobody has touched', async () => {
      await service.close();
      await start({ idleSeconds: 0.05 });

      const ada = await join('ada');
      await seen(ada, 'lobby_update');
      // Paused rather than closed: a close would evict and take the other path.
      ada.pause();

      await until(() => forgotten.includes(ROOM), 'the idle room to be forgotten', 4000);

      ada.resume();
      ada.close();
    });
  });

  describe('C1.3, D3 — what the server decides for itself', () => {
    /** A round in progress. The article comes through `settle`, as 5.8 will. */
    async function playRound(): Promise<{ ada: Opened; bob: Opened }> {
      const { ada, bob } = await lobby();

      ada.send({ type: 'start_game', topic: 'Chat' });
      // Waited for, not assumed: `article_ready` is refused outside `generating`
      // (D3), so settling before the start_game has landed starts nothing and
      // the failure looks like a lost article.
      await until(
        async () => (await store.read(ROOM)).state.phase === 'generating',
        'the generation to open',
      );
      await service.settle(ROOM, {
        kind: 'article_ready',
        article: ARTICLE,
        solution: SOLUTION,
      });
      await seen(ada, 'game_start');
      await seen(bob, 'game_start');

      return { ada, bob };
    }

    // C1.3 — the penalties used to arrive from the client and were taken at face
    // value, so sending zero cleared them. The schema has no field for them, so
    // the declaration is stripped at the frame boundary and never reaches a
    // rule; what the debrief shows is what the server billed.
    it('bills the hints it sold, whatever the client declares', async () => {
      const { ada, bob } = await playRound();

      ada.send({ type: 'unlock_hint', falseInfoNumber: 1, level: 1 });
      await seen(ada, 'hint_unlocked');

      ada.send({
        type: 'submit_answer',
        marked: [],
        // None of these exist in the contract. A client is free to send them.
        hintPenalty: 0,
        hintsUsed: 0,
        scoreStolen: 0,
      });
      bob.send({ type: 'submit_answer', marked: [] });
      await seen(ada, 'game_end');

      const end = of(ada, 'game_end')[0] as unknown as {
        leaderboard: {
          player: string;
          score: number;
          breakdown: { hintPenalty: number; hintsUsed: number };
        }[];
      };
      const mine = end.leaderboard.find((entry) => entry.player === 'ada');

      // C2.1 — one level-1 hint costs 50, and the time bonus is half the limit.
      expect(mine?.breakdown).toMatchObject({ hintPenalty: 50, hintsUsed: 1 });
      expect(mine?.score).toBe(TIME_LIMIT / 2 - 50);

      ada.close();
      bob.close();
    });

    // D3 — the current server has two start paths that disagree on what they
    // announce. Here `article_ready` is the only way in, and it is refused
    // outside `generating`: a late article from an abandoned generation cannot
    // restart a round that is already under way.
    it('starts a round once, from one path', async () => {
      const { ada, bob } = await playRound();

      await service.settle(ROOM, {
        kind: 'article_ready',
        article: { ...ARTICLE, topic: 'Chien' },
        solution: SOLUTION,
      });
      // A fence: chat rides the same channel, so once it has arrived any second
      // `game_start` would already be behind it.
      ada.send({ type: 'chat_message', content: 'done' });
      await seen(ada, 'chat_message');

      expect(of(ada, 'game_start')).toHaveLength(1);
      expect(of(ada, 'game_start')[0]).toMatchObject({ topic: 'Chat' });

      ada.close();
      bob.close();
    });
  });
});

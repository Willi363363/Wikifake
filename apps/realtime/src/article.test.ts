// 5.8's criteria, over real sockets: a topic becomes a round, a topic that
// yields nothing becomes the next candidate, and the round has a clock.
//
// Before this step `generate_article` was an effect nothing in this service
// answered, and `article_ready` is the only way into a round (D3) — so a
// multiplayer round could not start at all. Every other suite in this directory
// settled the article by hand to work around it; none of them do any more.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createLocalBus, type Bus } from './bus.js';
import { createOriginPolicy } from './origins.js';
import { createRoomStore, type RoomStore } from './rooms/store.js';
import { createLocalTokens } from './rooms/tokens.js';
import { createService, type Service, type ServiceOptions } from './server.js';
import { createLocalScheduler } from './timers/local.js';
import { open, until, type Opened } from './testing/client.js';
import { openTestRedis, testRedisUrl, type TestRedis } from './testing/redis.js';
import {
  canned,
  refusing,
  refusingFirst,
  ARTICLE,
  SOLUTION,
  type StubSource,
} from './testing/articles.js';

const url = testRedisUrl();
const NAMESPACE = 'wikifake:test:article';

let rooms = 0;
const nextRoom = (): string => `G${String(++rooms).padStart(5, '0')}`;

const TIME_LIMIT = 120;
/** A clock the test owns, so a time bonus is a fact rather than a stopwatch. */
const FROZEN = 1_700_000_000_000;

type Message = { readonly type: string } & Record<string, unknown>;

const of = (client: Opened, type: string): Message[] =>
  (client.received as Message[]).filter((message) => message.type === type);

describe.skipIf(url === null)('5.8 — a topic becomes a round', () => {
  let redis: TestRedis;
  let store: RoomStore;
  let bus: Bus;
  let service: Service;
  let port: number;
  let ROOM: string;
  let clock: number;

  beforeAll(async () => {
    redis = await openTestRedis(url as string, NAMESPACE);
  });
  afterAll(async () => {
    await redis.close();
  });

  const start = async (articles: StubSource): Promise<StubSource> => {
    const options: ServiceOptions = {
      origins: createOriginPolicy(['https://wikifake.example']),
      roomExists: () => Promise.resolve(true),
      closeRoom: () => Promise.resolve(),
      rooms: store,
      bus,
      namespace: NAMESPACE,
      scheduler: createLocalScheduler,
      tokens: createLocalTokens(),
      articles,
      now: () => clock,
    };
    service = createService(options);
    port = await service.listen(0);
    return articles;
  };

  beforeEach(async () => {
    await redis.flush();
    ROOM = nextRoom();
    clock = FROZEN;
    store = createRoomStore({ redis: redis.redis, namespace: NAMESPACE });
    bus = createLocalBus();
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

  /** Two players who have voted for a topic. What used to lead nowhere. */
  async function vote(): Promise<{ ada: Opened; bob: Opened }> {
    const ada = await join('ada');
    const bob = await join('bob');

    ada.send({ type: 'set_ready', ready: true, withItems: false, timeLimit: TIME_LIMIT });
    bob.send({ type: 'set_ready', ready: true });
    ada.send({ type: 'force_start' });
    await seen(bob, 'theme_vote_start');

    ada.send({ type: 'submit_theme', topic: 'Chat' });
    bob.send({ type: 'submit_theme', topic: 'Chat' });

    return { ada, bob };
  }

  // The criterion. The model and Wikipedia are mocked; everything between the
  // vote and the round is the real thing.
  it('turns a topic the room voted for into a round', async () => {
    const articles = await start(canned(ARTICLE, SOLUTION));
    const { ada, bob } = await vote();

    await seen(ada, 'game_start');
    await seen(bob, 'game_start');

    // What the pipeline was asked for: the room, the topic, and who is in it —
    // the players the round is being started for, not whoever is there when it
    // finishes.
    expect(articles.asked).toHaveLength(1);
    expect(articles.asked[0]).toMatchObject({
      roomCode: ROOM,
      topic: 'Chat',
      timeLimit: TIME_LIMIT,
    });
    expect(articles.asked[0]?.players.map((player) => player.name)).toEqual([
      'ada',
      'bob',
    ]);

    // And what the players got: the article, and no more of it than C1.1 allows.
    expect(of(ada, 'game_start')[0]).toMatchObject({
      topic: 'Chat',
      paragraphs: ARTICLE.paragraphs,
      totalFakes: 1,
    });
    expect(JSON.stringify(ada.received)).not.toContain('TRUTHMARKER');

    ada.close();
    bob.close();
  });

  // C3.7 — a topic nobody wrote about is an ordinary outcome of letting players
  // type whatever they like, not an exception.
  it('falls back to the next candidate when a topic yields nothing', async () => {
    const articles = await start(refusingFirst(1, ARTICLE, SOLUTION));
    const { ada, bob } = await vote();

    await seen(ada, 'game_start');

    expect(articles.asked).toHaveLength(2);
    expect(articles.asked[0]?.topic).toBe('Chat');
    // A different topic, drawn from the queue built when the vote closed.
    expect(articles.asked[1]?.topic).not.toBe('Chat');
    // Announced, so the players see the topic change rather than a silence.
    expect(of(ada, 'theme_selected').length).toBeGreaterThanOrEqual(2);

    ada.close();
    bob.close();
  });

  // C3.7's other end. The current server broadcasts a French sentence with no
  // code and leaves the room in its generating phase for ever.
  it('gives up on the lobby, with a code, when nothing works', async () => {
    const articles = await start(refusing());
    const { ada, bob } = await vote();

    await until(
      () => of(ada, 'error').some((message) => message['code'] === 'generation_failed'),
      'the room to give up',
      10_000,
    );

    expect(of(ada, 'game_start')).toHaveLength(0);
    expect((await store.read(ROOM)).state.phase).toBe('lobby');
    // Every candidate was tried, not just the first.
    expect(articles.asked.length).toBeGreaterThan(1);

    ada.close();
    bob.close();
  });

  // A generation that throws — a database blip, a driver that gives up — is a
  // generation that failed. Nothing else will ever settle this one, and a room
  // left in `generating` waits for an article that is not coming, which is
  // exactly the state the current server gets stuck in.
  it('treats a generation that throws as one that failed', async () => {
    const thrower: StubSource = {
      asked: [],
      open: (request) => {
        thrower.asked.push(request);
        return Promise.reject(new Error('the database is unreachable'));
      },
    };
    await start(thrower);
    const { ada, bob } = await vote();

    await until(
      () => of(ada, 'error').some((message) => message['code'] === 'generation_failed'),
      'the room to give up',
      10_000,
    );
    expect((await store.read(ROOM)).state.phase).toBe('lobby');

    ada.close();
    bob.close();
  });

  describe('the round clock', () => {
    // The criterion's third part, and the defect recorded in step 5.6: nothing
    // stamped a message, so the reducer decided every one of them as though the
    // round had just begun.
    it('charges the time that passed to the time bonus', async () => {
      await start(canned(ARTICLE, SOLUTION));
      const { ada, bob } = await vote();
      await seen(ada, 'game_start');

      // A hundred seconds of play, on a clock the test moves.
      clock += 100_000;
      ada.send({ type: 'submit_answer', marked: [] });
      bob.send({ type: 'submit_answer', marked: [] });
      await seen(ada, 'game_end');

      const end = of(ada, 'game_end')[0] as unknown as {
        leaderboard: { player: string; breakdown: { timeBonus: number } }[];
      };
      // C2.1 — half a point per second left, truncated.
      expect(end.leaderboard[0]?.breakdown.timeBonus).toBe((TIME_LIMIT - 100) / 2);

      ada.close();
      bob.close();
    });

    // The round starts when the article is ready, not when the topic was picked:
    // the minutes spent reading Wikipedia are not minutes anybody was playing.
    it('does not charge the players for the generation', async () => {
      const slow: StubSource = (() => {
        const inner = canned(ARTICLE, SOLUTION);
        return {
          asked: inner.asked,
          open: async (request) => {
            // A minute of Wikipedia and model, on the test's clock.
            clock += 60_000;
            return inner.open(request);
          },
        };
      })();
      await start(slow);

      const { ada, bob } = await vote();
      await seen(ada, 'game_start');

      ada.send({ type: 'submit_answer', marked: [] });
      bob.send({ type: 'submit_answer', marked: [] });
      await seen(ada, 'game_end');

      const end = of(ada, 'game_end')[0] as unknown as {
        leaderboard: { player: string; breakdown: { timeBonus: number } }[];
      };
      expect(end.leaderboard[0]?.breakdown.timeBonus).toBe(TIME_LIMIT / 2);

      ada.close();
      bob.close();
    });
  });
});

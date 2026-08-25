// 5.6's criteria, over real sockets: what a client may send, how often, and
// what the server does with the rest.
//
// All four are things the current server gets wrong (D6, D7). Three of them the
// rules already refuse — `validateTargets`, `set_ready` out of the lobby, and
// `FREEZE_TIME`'s time penalty were written in phase 1 — and this file is what
// says they are reachable from a socket rather than only from a unit test. The
// fourth, the throttle, is new here: it is transport, and it is the only one of
// the four that never reaches the rules at all.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ArticleView, FalsifiedPosition, ItemInstance } from '@wikifake/protocol';

import { createLocalBus, type Bus } from './bus.js';
import { createOriginPolicy } from './origins.js';
import { createRoomStore, type RoomStore } from './rooms/store.js';
import { createLocalTokens } from './rooms/tokens.js';
import { createService, type Service } from './server.js';
import { createLocalScheduler } from './timers/local.js';
import { open, until, type Opened } from './testing/client.js';
import { openTestRedis, testRedisUrl, type TestRedis } from './testing/redis.js';

const url = testRedisUrl();
const NAMESPACE = 'wikifake:test:hardening';

let rooms = 0;
const nextRoom = (): string => `H${String(++rooms).padStart(5, '0')}`;

/** Chosen, not defaulted: every time bonus below is read against this number. */
const TIME_LIMIT = 120;

/** Wide enough that one burst yields exactly one frame, on any machine. */
const WIDE_MS = 60_000;

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

const of = (client: Opened, type: string): Message[] =>
  (client.received as Message[]).filter((message) => message.type === type);

describe.skipIf(url === null)('5.6 — what a client is allowed to send', () => {
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

  beforeEach(async () => {
    await redis.flush();
    ROOM = nextRoom();

    store = createRoomStore({ redis: redis.redis, namespace: NAMESPACE });
    bus = createLocalBus();
    service = createService({
      origins: createOriginPolicy(['https://wikifake.example']),
      roomExists: () => Promise.resolve(true),
      rooms: store,
      bus,
      namespace: NAMESPACE,
      scheduler: createLocalScheduler,
      tokens: createLocalTokens(),
      // A minute, so "what got through" is one frame rather than a race with
      // the scheduler. The interval itself is `throttle.test.ts`.
      throttleMs: { cursor: WIDE_MS, live_score: WIDE_MS },
    });
    port = await service.listen(0);
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

  /**
   * Two players in a round, ada hosting, on a chosen time limit.
   *
   * The article comes through `settle` — the door step 5.8 will use — because
   * `generate_article` is an effect nothing answers yet.
   */
  async function playRound(): Promise<{ ada: Opened; bob: Opened }> {
    const ada = await join('ada');
    const bob = await join('bob');

    ada.send({ type: 'set_ready', ready: true, withItems: true, timeLimit: TIME_LIMIT });
    bob.send({ type: 'set_ready', ready: true });
    ada.send({ type: 'force_start' });
    ada.send({ type: 'submit_theme', topic: 'Chat' });
    ada.send({ type: 'force_pick' });
    await seen(ada, 'theme_selected');

    await service.settle(ROOM, {
      kind: 'article_ready',
      article: ARTICLE,
      solution: SOLUTION,
    });
    await seen(ada, 'game_start');
    await seen(bob, 'game_start');

    return { ada, bob };
  }

  /** Puts one item straight into a hand: the waves are 5.4's, and are timed. */
  const give = (player: string, item: ItemInstance): Promise<void> =>
    service.settle(ROOM, { kind: 'items_granted', wave: 1, grants: { [player]: item } });

  const optionsNow = async (): Promise<{ timeLimit: number }> =>
    (await store.read(ROOM)).state.options;

  const handOf = async (name: string): Promise<readonly ItemInstance[]> =>
    (await store.read(ROOM)).state.players.find((player) => player.name === name)?.hand ??
    [];

  // The criterion. D6 — `live_score` is rebroadcast to the whole room and the
  // current server neither validates nor limits it.
  it('does not rebroadcast a live_score flood beyond the throttle', async () => {
    const { ada, bob } = await playRound();

    for (let score = 0; score < 30; score += 1) ada.send({ type: 'live_score', score });
    // A fence: chat is not throttled and rides the same per-socket queue, so
    // once bob has it every admitted `live_score` is already behind it.
    ada.send({ type: 'chat_message', content: 'done' });
    await seen(bob, 'chat_message');

    const relayed = of(bob, 'live_score_update');
    expect(relayed).toHaveLength(1);
    // The first, not the last: a frame over the limit is dropped where it
    // stands rather than held back and sent late.
    expect(relayed[0]).toMatchObject({ player: 'ada', score: 0 });

    ada.close();
    bob.close();
  });

  it('does not relay a cursor flood beyond the throttle', async () => {
    const { ada, bob } = await playRound();

    for (let step = 0; step < 30; step += 1) {
      ada.send({ type: 'cursor', x: step / 100, y: 0.5 });
    }
    ada.send({ type: 'chat_message', content: 'done' });
    await seen(bob, 'chat_message');

    expect(of(bob, 'cursor_update')).toHaveLength(1);

    ada.close();
    bob.close();
  });

  // A throttle that also swallowed what changes the room would be a worse bug
  // than the flood it prevents.
  it('holds back nothing else', async () => {
    const { ada, bob } = await playRound();

    for (let sent = 0; sent < 10; sent += 1) {
      ada.send({ type: 'chat_message', content: `line ${String(sent)}` });
    }
    await seen(bob, 'chat_message', 10);

    expect(of(bob, 'chat_message')).toHaveLength(10);

    ada.close();
    bob.close();
  });

  // The criterion. D6 — the current server walks whatever list arrived, so a
  // player can steal fifty points from themselves.
  it('refuses a player targeting themselves', async () => {
    const { ada, bob } = await playRound();
    await give('ada', { instanceId: 'i-1', itemId: 'SCORE_STEAL' });
    await seen(ada, 'items_distributed');

    ada.send({ type: 'use_item', instanceId: 'i-1', targets: ['ada'], marked: [] });
    await seen(ada, 'error');

    expect(of(ada, 'error')[0]).toMatchObject({ code: 'invalid_target' });
    // Refused before it is spent: the item is still hers to use properly.
    expect(await handOf('ada')).toHaveLength(1);

    ada.close();
    bob.close();
  });

  // The other half of D6: naming one rival eight times multiplied one item into
  // eight effects.
  it('refuses a target list the item has no room for', async () => {
    const { ada, bob } = await playRound();
    await give('ada', { instanceId: 'i-2', itemId: 'SCORE_STEAL' });
    await seen(ada, 'items_distributed');

    ada.send({
      type: 'use_item',
      instanceId: 'i-2',
      targets: ['bob', 'bob', 'bob'],
      marked: [],
    });
    await seen(ada, 'error');

    expect(of(ada, 'error')[0]).toMatchObject({ code: 'invalid_target' });
    expect(await handOf('ada')).toHaveLength(1);

    ada.close();
    bob.close();
  });

  // The criterion. D6 — `set_ready` accepted a `time_limit` from the host
  // mid-round, which changed the time bonus of every later submission.
  it('freezes the time limit once the round has started', async () => {
    const { ada, bob } = await playRound();
    expect((await optionsNow()).timeLimit).toBe(TIME_LIMIT);

    // The host, in a round, asking for a limit that would double every bonus.
    ada.send({ type: 'set_ready', ready: true, timeLimit: 240 });
    await seen(ada, 'error');

    expect(of(ada, 'error')[0]).toMatchObject({ code: 'out_of_phase' });
    expect((await optionsNow()).timeLimit).toBe(TIME_LIMIT);

    ada.close();
    bob.close();
  });

  // The criterion. D7 — the item is declared but `_apply_scoring_effect` only
  // handles `SCORE_STEAL` and `HINT_LOCK`, so the ten seconds are purely
  // visual and cost their target nothing.
  it('makes FREEZE_TIME eat into the time bonus', async () => {
    const { ada, bob } = await playRound();
    await give('bob', { instanceId: 'i-3', itemId: 'FREEZE_TIME' });
    await seen(bob, 'items_distributed');

    bob.send({ type: 'use_item', instanceId: 'i-3', targets: ['ada'], marked: [] });
    await seen(ada, 'item_effect');

    bob.send({ type: 'submit_answer', marked: [] });
    ada.send({ type: 'submit_answer', marked: [] });
    await seen(ada, 'game_end');

    const end = of(ada, 'game_end')[0] as unknown as {
      leaderboard: { player: string; breakdown: { timeBonus: number } }[];
    };
    const bonusOf = (name: string): number =>
      end.leaderboard.find((entry) => entry.player === name)?.breakdown.timeBonus ?? -1;

    // C2.1 — half a point per second left. Bob keeps the whole limit; ada is
    // charged the ten seconds the item ate, and the difference is five points.
    expect(bonusOf('bob')).toBe(TIME_LIMIT / 2);
    expect(bonusOf('ada')).toBe((TIME_LIMIT - 10) / 2);

    ada.close();
    bob.close();
  });
});

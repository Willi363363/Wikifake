// 5.4's criteria: a round whose last non-submitted player disconnects ends by
// server-side timeout, and an idle room disappears when its TTL expires.
//
// Against the real queue on a real Redis. A delayed job kept in Redis is the
// whole difference from the `asyncio.Task` it replaces — it survives the
// redeployment that forgets a `setTimeout`, and an alarm armed by one instance
// is rung by whichever one is free — so proving it against an in-process
// scheduler would prove the thing it is not.
//
// D4, in one sentence: today `time_limit` is enforced by the client alone, so a
// round nobody submits to stays open for ever.
//
// The round's real deadline is at least thirty seconds away — the contract's
// floor — so the tests wrap the real scheduler and shorten the delay it is armed
// with. The queue still does every bit of the work; what is shortened is the
// waiting. That `arm_timer` asks for `timeLimit` seconds in the first place is
// `timers/arming.test.ts`, against a scheduler that records.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ArticleView, FalsifiedPosition } from '@wikifake/protocol';

import { createLocalBus, type Bus } from './bus.js';
import { createOriginPolicy } from './origins.js';
import { createLocalTokens } from './rooms/tokens.js';
import { createRoomStore, type RoomStore } from './rooms/store.js';
import { createService, type Service } from './server.js';
import { createQueueScheduler } from './timers/queue.js';
import { open, until, type Opened } from './testing/client.js';
import { openTestRedis, testRedisUrl, type TestRedis } from './testing/redis.js';
import { alarmId, type Alarm, type OnAlarm, type Scheduler } from './timers/scheduler.js';

const url = testRedisUrl();
const NAMESPACE = 'wikifake:test:timers';

let rooms = 0;
const nextRoom = (): string => `T${String(++rooms).padStart(5, '0')}`;

/**
 * An article, handed to the room through the door 5.8 will use.
 *
 * `generate_article` is still nobody's effect: no step had claimed the article
 * pipeline for this service, which is why 5.8 now exists in the sheet. A round
 * has to start somehow, and `article_ready` is the only thing that starts one
 * (D3), so the test plays the part the pipeline will play.
 */
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

const SOON_MS = 60;

/**
 * Longer than the other suites wait, for one reason: BullMQ connects and loads
 * its Lua scripts on the first alarm of a process. Seconds once, milliseconds
 * afterwards — and the first test of the file is the one that pays it.
 */
const PATIENCE_MS = 10_000;

/** Where BullMQ keeps a job: its prefix, the queue name, then the job id. */
const alarmKey = (roomCode: string, kind: Alarm['kind']): string =>
  `${NAMESPACE}:room-timers:${alarmId(roomCode, kind)}`;

describe.skipIf(url === null)('5.4 — the server ends what nobody ends', () => {
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
   * The real queue, with the wait taken out.
   *
   * Only the delay is touched. Arming, replacing, cancelling, the worker and the
   * round trip through Redis are the production ones.
   */
  function impatient(onAlarm: OnAlarm, shorten: readonly Alarm['kind'][]): Scheduler {
    const real = createQueueScheduler({
      url: url as string,
      namespace: NAMESPACE,
      onAlarm,
    });

    return {
      arm: (alarm, delayMs) =>
        real.arm(
          alarm,
          shorten.includes(alarm.kind)
            ? // Scaled by the wave rather than flattened: the nine of them are
              // armed together at fixed offsets, and collapsing them onto one
              // instant would lose the order the test is about.
              SOON_MS * (alarm.wave ?? 1)
            : delayMs,
        ),
      cancel: (roomCode, kind, wave) => real.cancel(roomCode, kind, wave),
      close: () => real.close(),
    };
  }

  async function start(shorten: readonly Alarm['kind'][]): Promise<void> {
    store = createRoomStore({
      redis: redis.redis,
      namespace: NAMESPACE,
      idleSeconds: 60,
    });
    bus = createLocalBus();
    service = createService({
      origins: createOriginPolicy(['https://wikifake.example']),
      roomExists: () => Promise.resolve(true),
      rooms: store,
      bus,
      tokens: createLocalTokens(),
      // D5 — a dropped socket becomes a departure only after the window.
      graceSeconds: 0.05,
      namespace: NAMESPACE,
      scheduler: (onAlarm) => impatient(onAlarm, shorten),
      // Always the first item, so a wave is something a test can name.
      pick: () => 0,
    });
    port = await service.listen(0);
  }

  beforeEach(async () => {
    await redis.flush();
    ROOM = nextRoom();
  });

  afterEach(async () => {
    await service.close();
    await bus.close();
  });

  const join = (name: string): Promise<Opened> =>
    open(port, `/ws/${ROOM}/${encodeURIComponent(name)}`);

  const of = (client: Opened, type: string): unknown[] =>
    client.received.filter((message) => (message as { type: string }).type === type);

  const roster = (client: Opened): string[] =>
    (
      (
        client.received
          .filter((message) => (message as { type: string }).type === 'lobby_update')
          .at(-1) as { players?: { name: string }[] } | undefined
      )?.players ?? []
    ).map((player) => player.name);

  /** Two players, both ready, a topic picked, and an article delivered. */
  async function playRound(withItems: boolean): Promise<{ ada: Opened; bob: Opened }> {
    const ada = await join('ada');
    const bob = await join('bob');
    await until(() => roster(ada).length === 2, 'both players', PATIENCE_MS);

    ada.send({ type: 'set_ready', ready: true, withItems });
    bob.send({ type: 'set_ready', ready: true });
    await until(
      () => roster(bob).length === 2 && of(ada, 'lobby_update').length >= 3,
      () =>
        `both to be ready (ada saw ${String(of(ada, 'lobby_update').length)} lobbies, bob's roster ${JSON.stringify(roster(bob))})`,
      PATIENCE_MS,
    );

    ada.send({ type: 'force_start' });
    ada.send({ type: 'submit_theme', topic: 'Chat' });
    ada.send({ type: 'force_pick' });
    await until(
      () => of(ada, 'theme_selected').length > 0,
      'the topic to be picked',
      PATIENCE_MS,
    );

    await service.settle(ROOM, {
      kind: 'article_ready',
      article: ARTICLE,
      solution: SOLUTION,
    });
    await until(
      () => of(ada, 'game_start').length > 0,
      'the round to start',
      PATIENCE_MS,
    );

    return { ada, bob };
  }

  // The criterion, first half. Nobody submits, and the round ends anyway — which
  // is the thing the current server never does.
  it('ends a round by timeout when nobody submits', async () => {
    await start(['round_end']);
    const { ada, bob } = await playRound(false);

    await until(
      () => of(ada, 'game_end').length > 0,
      'the round to end on its own',
      PATIENCE_MS,
    );

    expect(of(bob, 'game_end')).toHaveLength(1);
    // C1.2 — and the solution arrives with it, for the first and only time.
    expect(JSON.stringify(of(ada, 'game_end'))).toContain('TRUTHMARKER-quatre-heures');
    expect(JSON.stringify(of(ada, 'game_start'))).not.toContain('TRUTHMARKER');

    ada.close();
    bob.close();
  });

  // The other half of the same sentence. D5 moved which event it is: a dropped
  // socket no longer ends anything — the player may be back — and what ends the
  // round early is the eviction at the end of their grace window.
  it('ends a round when the last non-submitted player is evicted', async () => {
    await start([]);
    const { ada, bob } = await playRound(false);

    ada.send({ type: 'submit_answer', marked: [1] });
    await until(
      () => of(ada, 'game_end').length + of(bob, 'game_end').length === 0,
      'a moment',
    );

    bob.close();
    await until(() => of(ada, 'game_end').length > 0, 'the round to end', PATIENCE_MS);

    // And the alarm that would have ended it later is gone, so it cannot fire
    // into the next round — the phase's last pitfall.
    expect(await redis.client.exists(alarmKey(ROOM, 'round_end'))).toBe(0);
    ada.close();
  });

  // The criterion, second half.
  it('forgets a room nobody has touched', async () => {
    await start(['room_idle']);

    const ada = await join('ada');
    await until(() => roster(ada).length === 1, 'the lobby');
    ada.close();

    // The last player leaving closes the room outright (C1.8), so the idle alarm
    // is about the other case: a room whose sockets are gone without a clean
    // leave. Written directly, then left alone.
    await store.apply(ROOM, { kind: 'join', player: 'ghost' });
    expect((await store.read(ROOM)).revision).toBeGreaterThan(0);

    // Polled rather than awaited: nobody holds a promise for an alarm.
    const idle = alarmKey(ROOM, 'room_idle');
    const deadline = Date.now() + 3000;
    let armed = await redis.client.exists(idle);
    while (armed !== 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      armed = await redis.client.exists(idle);
    }
    expect(armed).toBe(0);

    // What the alarm leaves behind: no round-end and no wave alarm for a room
    // nobody is in, so nothing rings against a room rebuilt under the same code.
    expect(await redis.client.exists(alarmKey(ROOM, 'round_end'))).toBe(0);
  });

  it('distributes an item wave, and chains the next one', async () => {
    await start(['item_wave']);
    const { ada, bob } = await playRound(true);

    await until(() => of(ada, 'items_distributed').length >= 2, 'two waves', PATIENCE_MS);

    const [first] = of(ada, 'items_distributed') as {
      wave: number;
      items: Record<string, { instanceId: string; itemId: string }>;
    }[];
    expect(first?.wave).toBe(1);
    // One per player, and the instance says who and which wave: a player can
    // hold two of the same item, and spending one must not spend both.
    expect(Object.keys(first?.items ?? {}).sort()).toEqual(['ada', 'bob']);
    expect(first?.items['ada']?.instanceId).toContain('ada_1_');
    expect(of(bob, 'items_distributed').length).toBeGreaterThanOrEqual(2);

    ada.close();
    bob.close();
  });
});

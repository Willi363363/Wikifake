// Track Q — what a collaborator saying *no* does to this service.
//
// Four defects found by a review of the whole repository on 2026-09-17 and
// written up in `plans/current-state/12-realtime-debt.md`. Three of the four
// were **reproduced by a probe before the sheet was written**, and the
// assertion each one printed is in the register beside it; the cases below are
// those probes, kept.
//
// They share track O's shape one turn out. O.1 fixed the `error` **event**
// nobody listened for; these are the `Promise` nobody holds — the other half of
// Node's error model, and in one case two lines below O.1's own fix.
//
// The assertion is on `unhandledRejection` rather than on the runner falling
// over, for the reason `availability.test.ts` gives about `uncaughtException`:
// without the fix these do not fail, they take the runner down, and Vitest
// reports a green suite on a red job — the shape `10-test-debt.md` warns about.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLocalBus } from './bus.js';
import { createRegistry } from './connections.js';
import { createOriginPolicy } from './origins.js';
import { createRoomStore } from './rooms/store.js';
import { createLocalTokens } from './rooms/tokens.js';
import { createService, type Service, type ServiceOptions } from './server.js';
import { createSubscriptions } from './subscriptions.js';
import { stubArticles } from './testing/articles.js';
import { createLocalScheduler } from './timers/local.js';
import { open, until } from './testing/client.js';

const ROOM = 'A1B2C3';
const APP = 'https://wikifake.example';

/** The two commands the store uses, over a `Map`. `store.test.ts` drives Redis. */
function fakeRedis() {
  const rooms = new Map<string, { revision: number; state: string }>();
  return {
    hmGet: (key: string): Promise<(string | null)[]> => {
      const held = rooms.get(key);
      return Promise.resolve(
        held === undefined ? [null, null] : [String(held.revision), held.state],
      );
    },
    eval: (script: string, options: { keys: string[]; arguments: string[] }) => {
      const key = options.keys[0] as string;
      const revision = rooms.get(key)?.revision ?? 0;
      if (String(revision) !== options.arguments[0])
        return Promise.resolve([0, String(revision)]);
      if (script.includes('DEL')) {
        rooms.delete(key);
        return Promise.resolve([1, '0']);
      }
      rooms.set(key, { revision: revision + 1, state: options.arguments[1] as string });
      return Promise.resolve([1, String(revision + 1)]);
    },
  };
}

let service: Service | undefined;

const start = async (extra: Partial<ServiceOptions> = {}): Promise<number> => {
  service = createService({
    origins: createOriginPolicy([APP]),
    roomExists: () => Promise.resolve(true),
    closeRoom: () => Promise.resolve(),
    recordResults: () => Promise.resolve(),
    rooms: createRoomStore({ redis: fakeRedis(), namespace: 'resilience' }),
    bus: createLocalBus(),
    tokens: createLocalTokens(),
    articles: stubArticles(),
    scheduler: createLocalScheduler,
    ...extra,
  });
  return service.listen(0);
};

/** Everything that escaped while `work` ran. */
async function escaping(work: () => Promise<void>): Promise<string[]> {
  const escaped: unknown[] = [];
  const caught = (reason: unknown): void => void escaped.push(reason);
  process.on('unhandledRejection', caught);
  try {
    await work();
    // A rejection is reported a turn after it is abandoned, so the wait is the
    // measurement rather than padding.
    await new Promise((resolve) => setTimeout(resolve, 200));
  } finally {
    process.off('unhandledRejection', caught);
  }
  return escaped.map((error) => String(error));
}

afterEach(async () => {
  await service?.close();
  service = undefined;
  vi.restoreAllMocks();
});

describe('Q.2 — a handshake that cannot reach the database', () => {
  it('refuses the socket instead of ending the process', async () => {
    // What `main.ts` passes is `selectRoom(db, code)`, so this is a database
    // that blinked while somebody was joining — not an exotic case.
    const port = await start({
      roomExists: () => Promise.reject(new Error('the database is not answering')),
    });

    let closedWith: number | undefined;
    const escaped = await escaping(async () => {
      const client = await open(port, `/ws/${ROOM}/Ada`, { origin: APP });
      closedWith = await client.closed();
    });

    expect(escaped).toEqual([]);
    // 1008, the same refusal a room that really is not there gets: from where
    // the player sits the two are one room.
    expect(closedWith).toBe(1008);
  });
});

describe('Q.3 — a departure whose grace alarm cannot be armed', () => {
  it('still departs, and nothing escapes', async () => {
    let failArm = false;
    const port = await start({
      scheduler: (onAlarm) => {
        const real = createLocalScheduler(onAlarm);
        return {
          ...real,
          arm: (alarm, delayMs) =>
            failArm && alarm.kind === 'grace'
              ? Promise.reject(new Error('redis is not answering'))
              : real.arm(alarm, delayMs),
        };
      },
    });

    const client = await open(port, `/ws/${ROOM}/Ada`, { origin: APP });
    await until(
      () => service?.connections.holds(ROOM, 'Ada') === true,
      'the socket to be registered',
    );

    const escaped = await escaping(async () => {
      failArm = true;
      client.close();
      await until(
        () => service?.connections.holds(ROOM, 'Ada') === false,
        'the departing socket to leave the registry',
      );
    });

    // Every player leaving during a Redis outage used to make one of these.
    expect(escaped).toEqual([]);
  });
});

describe('Q.4 — a subscription that failed once', () => {
  it('can be made again, rather than leaving the room deaf', async () => {
    const real = createLocalBus();
    let attempts = 0;

    const subscriptions = createSubscriptions({
      bus: {
        publish: (channel: string, payload: string) => real.publish(channel, payload),
        subscribe: (channel: string, onMessage: (payload: string) => void) => {
          attempts += 1;
          return attempts === 1
            ? Promise.reject(new Error('redis is not answering'))
            : real.subscribe(channel, onMessage);
        },
        close: () => real.close(),
      },
      namespace: 'resilience',
      connections: createRegistry(),
    });

    // The first socket for the room arrives while Redis is down.
    await expect(subscriptions.listen(ROOM)).rejects.toThrow('redis');
    // Redis is back, and the next socket arrives. Before Q.4 the claim the
    // failed attempt had staked was still in the map, so this call incremented
    // a counter and subscribed nothing — for the life of the process.
    await subscriptions.listen(ROOM);

    expect(attempts).toBe(2);
    await subscriptions.closeAll();
  });

  it('lets two sockets arriving together share one subscription', () => {
    // The property the placeholder existed to protect, kept: the fix must not
    // trade a permanent deafness for a double delivery.
    const real = createLocalBus();
    let attempts = 0;

    const subscriptions = createSubscriptions({
      bus: {
        publish: (channel: string, payload: string) => real.publish(channel, payload),
        subscribe: (channel: string, onMessage: (payload: string) => void) => {
          attempts += 1;
          return real.subscribe(channel, onMessage);
        },
        close: () => real.close(),
      },
      namespace: 'resilience',
      connections: createRegistry(),
    });

    return Promise.all([subscriptions.listen(ROOM), subscriptions.listen(ROOM)]).then(
      async () => {
        expect(attempts).toBe(1);
        await subscriptions.closeAll();
      },
    );
  });
});

describe('Q.5 — a socket that throws between the registry and the join', () => {
  /**
   * O.2 made a socket that **closed** before its join depart properly. Neither
   * of its two ordering booleans is set when one of the four awaits **throws**,
   * so `close` ran with `joined` false, `depart` never ran, and the room kept a
   * player who never readies — O.2's symptom, by the other door.
   *
   * `scheduler.cancel` is the throw here because it sits between the
   * subscription and the join, so the case exercises the release of something
   * already taken as well as the registry.
   */
  it('leaves no phantom in the room, and frees the nickname', async () => {
    let failCancel = true;
    const port = await start({
      scheduler: (onAlarm) => {
        const real = createLocalScheduler(onAlarm);
        return {
          ...real,
          cancel: (roomCode, kind, player) =>
            failCancel
              ? Promise.reject(new Error('redis is not answering'))
              : real.cancel(roomCode, kind, player),
        };
      },
    });

    const escaped = await escaping(async () => {
      const doomed = await open(port, `/ws/${ROOM}/Ada`, { origin: APP });
      await doomed.closed();
    });

    // Q.2's catch owns the refusal, so nothing escapes here either.
    expect(escaped).toEqual([]);
    // The registry is clean: before Q.5 the connection stayed for the life of
    // the process, holding the nickname against its own owner.
    expect(service?.connections.holds(ROOM, 'Ada')).toBe(false);

    // And the player can come back under the same name — which they could not
    // while the slot was still claimed by a socket that never joined.
    failCancel = false;
    const second = await open(port, `/ws/${ROOM}/Ada`, { origin: APP });
    await until(
      () => service?.connections.holds(ROOM, 'Ada') === true,
      'the second socket to take the nickname back',
    );
    second.close();
  });
});

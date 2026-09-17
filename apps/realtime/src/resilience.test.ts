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
import { createOriginPolicy } from './origins.js';
import { createRoomStore } from './rooms/store.js';
import { createLocalTokens } from './rooms/tokens.js';
import { createService, type Service, type ServiceOptions } from './server.js';
import { stubArticles } from './testing/articles.js';
import { createLocalScheduler } from './timers/local.js';
import { open } from './testing/client.js';

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

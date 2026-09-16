// Step O.5 — an event that changes nothing writes nothing.
//
// Against a real Redis, because what is asserted is what reached it: the key's
// revision, and the key's expiry. A fake would prove the fake, which is the
// argument `store.test.ts` already makes about the scripts.
//
// The measurement this closes is in `plans/current-state/09-query-debt.md`. A
// room in a round holds the whole article and the whole solution — 20.3 KiB —
// and `cursor` returns the state it was handed, unchanged, sixteen times a
// second per player. Every one of them was read back, re-serialised, written,
// and took the revision with it; four players moved about 2.6 MB/s through
// Redis to change nothing at all.
//
// The revision is the half that was not merely wasteful. A `submit_answer` or a
// `use_item` racing four moving mice lost a compare-and-swap it had no reason to
// lose, and ten losses in a row are what `server.ts` turns into *"Ce salon n'est
// pas ouvert"* — said to somebody looking at the room.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createRoomStore, roomKey, type RoomStore } from './store.js';
import { lazyRedis } from '../redis.js';
import { openTestRedis, testRedisUrl, type TestRedis } from '../testing/redis.js';

const url = testRedisUrl();
const NAMESPACE = 'wikifake:test:unchanged';

describe.skipIf(url === null)('O.5 — the write an event does not need', () => {
  let store: RoomStore;
  let redis: TestRedis;
  let rooms = 0;
  const nextRoom = (): string => `U${String(++rooms).padStart(5, '0')}`;

  beforeEach(async () => {
    redis ??= await openTestRedis(url as string, NAMESPACE);
    await redis.flush();
    store = createRoomStore({
      redis: lazyRedis(url as string),
      namespace: NAMESPACE,
      // Short, so the expiry is a number this file can read rather than a claim.
      idleSeconds: 60,
    });
  });

  afterAll(async () => {
    await redis.close();
  });

  /** A room with two players in it, and the revision that left behind. */
  const twoPlayers = async (code: string): Promise<number> => {
    await store.apply(code, { kind: 'join', player: 'ada', userId: null });
    const second = await store.apply(code, {
      kind: 'join',
      player: 'bob',
      userId: null,
    });
    return second.revision;
  };

  const says = (from: string, message: unknown) =>
    ({ kind: 'message', from, message, at: Date.now() }) as Parameters<
      RoomStore['apply']
    >[1];

  it('leaves the revision alone for a cursor', async () => {
    const code = nextRoom();
    const before = await twoPlayers(code);

    const applied = await store.apply(
      code,
      says('ada', { type: 'cursor', x: 0.5, y: 0.5 }),
    );

    expect(applied.revision).toBe(before);
    // And the effects still happen: the other player is told where the pointer
    // is. Skipping the *write* must not skip the message.
    expect(applied.effects.map((effect) => effect.kind)).toEqual(['send']);
  });

  it.each([
    ['live_score', { type: 'live_score', score: 40 }],
    ['chat_message', { type: 'chat_message', content: 'salut' }],
    ['get_lobby', { type: 'get_lobby' }],
  ])('leaves the revision alone for %s', async (_name, message) => {
    const code = nextRoom();
    const before = await twoPlayers(code);

    const applied = await store.apply(code, says('ada', message));

    expect(applied.revision).toBe(before);
    expect(applied.effects.length).toBeGreaterThan(0);
  });

  it('still writes when the reducer changed something', async () => {
    const code = nextRoom();
    const before = await twoPlayers(code);

    const applied = await store.apply(
      code,
      says('ada', { type: 'set_ready', ready: true }),
    );

    expect(applied.revision).toBe(before + 1);
    // And it is the new state that came back out of Redis, not the old one.
    const held = await store.read(code);
    expect(held.state.players.find((player) => player.name === 'ada')?.ready).toBe(true);
  });

  /**
   * The trap the step sheet named, and the reason `TOUCH_SCRIPT` exists.
   *
   * The swap refreshed the key's expiry as a side effect of committing. An event
   * that no longer commits would therefore no longer refresh it, and a room
   * whose only traffic is cursors and chat would expire underneath the players
   * making it.
   */
  it('still keeps the room alive', async () => {
    const code = nextRoom();
    await twoPlayers(code);
    const key = roomKey(NAMESPACE, code);

    // Bring the expiry far below the idle limit, so a refresh is visible.
    await redis.client.pExpire(key, 5000);
    expect(await redis.client.pTTL(key)).toBeLessThanOrEqual(5000);

    await store.apply(code, says('ada', { type: 'cursor', x: 0.1, y: 0.2 }));

    // Back up to the full hour a silent room gets — 60 seconds here.
    expect(await redis.client.pTTL(key)).toBeGreaterThan(50_000);
  });

  /**
   * And the guard is the same one the other two scripts use.
   *
   * A touch is not a free pass. If somebody commits between this caller's read
   * and its touch, the revision it presents is stale and the touch must be
   * refused — then the ordinary retry loop reads the winner's state and decides
   * again, exactly as a refused swap does.
   *
   * Forced rather than waited for: a port that commits on somebody else's behalf
   * in the gap between the two calls is the only way to produce a race whose
   * whole window is two Redis round trips.
   */
  it('refuses to touch under a revision somebody else has moved', async () => {
    const code = nextRoom();
    await twoPlayers(code);
    const key = roomKey(NAMESPACE, code);

    const port = lazyRedis(url as string);
    let evaluations = 0;
    const racing = {
      hmGet: (hash: string, fields: string[]) => port.hmGet(hash, fields),
      eval: async (script: string, options: { keys: string[]; arguments: string[] }) => {
        // Once, and before the first touch reaches Redis: somebody else's
        // commit, landing in the gap this caller cannot see.
        if (evaluations++ === 0) await redis.client.hIncrBy(key, 'revision', 1);
        return port.eval(script, options);
      },
    };

    const racer = createRoomStore({
      redis: racing,
      namespace: NAMESPACE,
      idleSeconds: 60,
    });
    await redis.client.pExpire(key, 5000);

    const applied = await racer.apply(
      code,
      says('ada', { type: 'cursor', x: 0.1, y: 0.2 }),
    );

    // Two evaluations: the touch that was refused, and the one that was not.
    expect(evaluations).toBe(2);
    // It still answered, and still at the revision nobody moved after it.
    expect(applied.effects.map((effect) => effect.kind)).toEqual(['send']);
    expect(await redis.client.pTTL(key)).toBeGreaterThan(50_000);
  });
});

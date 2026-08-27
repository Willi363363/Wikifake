// 5.2's criteria, on a real Redis: two concurrent transitions on the same room
// are not lost, and the state re-read after every event is exactly the one the
// reducer produced.
//
// The second one is the stronger claim. "Not lost" could be satisfied by a lock;
// "exactly the one the reducer produced" is what says no rule leaked into the
// storage layer — the state that comes back out of Redis has to be, field for
// field, the object `reduceRoom` returned.
import { emptyRoom, reduceRoom, type RoomEvent, type RoomState } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createRoomStore, roomKey, type RoomStore } from './store.js';
import { openTestRedis, testRedisUrl, type TestRedis } from '../testing/redis.js';

const url = testRedisUrl();
const NAMESPACE = 'wikifake:test:store';
const ROOM = 'A1B2C3';

const join = (player: string): RoomEvent => ({ kind: 'join', player });
const leave = (player: string): RoomEvent => ({ kind: 'leave', player });
const evict = (player: string): RoomEvent => ({ kind: 'evict', player });

describe.skipIf(url === null)('5.2 — the room lives in Redis', () => {
  let redis: TestRedis;
  let store: RoomStore;

  beforeAll(async () => {
    redis = await openTestRedis(url as string, NAMESPACE);
    store = createRoomStore({ redis: redis.redis, namespace: NAMESPACE });
  });
  afterAll(async () => {
    await redis.close();
  });
  beforeEach(async () => {
    await redis.flush();
  });

  describe('no instance holds the truth', () => {
    it('starts a room nobody has written from an empty one', async () => {
      const held = await store.read(ROOM);

      expect(held.revision).toBe(0);
      expect(held.state).toEqual(emptyRoom());
    });

    // The criterion, and the reason it is worth stating: what comes back has to
    // be the reducer's object, not a reconstruction of it.
    it('reads back exactly what the reducer produced, after every event', async () => {
      const events: RoomEvent[] = [
        join('ada'),
        join('bob'),
        {
          kind: 'message',
          from: 'ada',
          message: { type: 'set_ready', ready: true },
          at: 0,
        },
        {
          kind: 'message',
          from: 'ada',
          message: { type: 'set_ready', ready: true, timeLimit: 120, withItems: false },
          at: 0,
        },
        {
          kind: 'message',
          from: 'bob',
          message: { type: 'set_ready', ready: true },
          at: 0,
        },
      ];

      // The same events against the same rules, decided entirely in memory. If
      // the store agrees with this at every step, nothing about the round is
      // being decided anywhere but the reducer.
      let expected: RoomState = emptyRoom();

      for (const event of events) {
        expected = reduceRoom(expected, event).state;
        const applied = await store.apply(ROOM, event);

        expect(applied.state).toEqual(expected);
        // And the copy Redis holds, not just the one the call returned: a store
        // that returned the right object and wrote a different one would pass
        // every assertion above.
        expect((await store.read(ROOM)).state).toEqual(expected);
      }

      expect(expected.options).toEqual({ withItems: false, timeLimit: 120 });
    });

    it('moves the revision forward on every commit', async () => {
      expect((await store.apply(ROOM, join('ada'))).revision).toBe(1);
      expect((await store.apply(ROOM, join('bob'))).revision).toBe(2);
      expect((await store.read(ROOM)).revision).toBe(2);
    });

    it('keeps two rooms apart', async () => {
      await store.apply(ROOM, join('ada'));
      await store.apply('D4E5F6', join('bob'));

      expect((await store.read(ROOM)).state.players.map((p) => p.name)).toEqual(['ada']);
      expect((await store.read('D4E5F6')).state.players.map((p) => p.name)).toEqual([
        'bob',
      ]);
    });

    // Nothing is carried between calls, so a store built from scratch — which is
    // what a second instance is — sees the same room.
    it('hands the same room to a store built from scratch', async () => {
      await store.apply(ROOM, join('ada'));

      const second = createRoomStore({ redis: redis.redis, namespace: NAMESPACE });
      const held = await second.read(ROOM);

      expect(held.revision).toBe(1);
      expect(held.state.players.map((player) => player.name)).toEqual(['ada']);
    });
  });

  describe('the criterion — two transitions at once', () => {
    // Both readers see revision 1 and decide against it. One commits; the other
    // is told its revision is gone and decides again against the state that won.
    // A read-modify-write without the compare would drop one of the two joins.
    it('loses neither of two concurrent joins', async () => {
      await store.apply(ROOM, join('ada'));

      await Promise.all([
        store.apply(ROOM, join('bob')),
        store.apply(ROOM, join('carol')),
      ]);

      const held = await store.read(ROOM);
      expect(held.state.players.map((player) => player.name).sort()).toEqual([
        'ada',
        'bob',
        'carol',
      ]);
      expect(held.revision).toBe(3);
    });

    it('loses none of a burst', async () => {
      const players = ['ada', 'bob', 'carol', 'dan', 'erin', 'frank', 'grace'];

      await Promise.all(players.map((player) => store.apply(ROOM, join(player))));

      const held = await store.read(ROOM);
      expect(held.state.players.map((player) => player.name).sort()).toEqual(
        [...players].sort(),
      );
      expect(held.revision).toBe(players.length);
    });

    // Two different kinds of event racing, which is the case a per-event lock
    // would still get wrong if it locked on the event rather than on the room.
    it('applies a join and a ready in whichever order they land', async () => {
      await store.apply(ROOM, join('ada'));

      await Promise.all([
        store.apply(ROOM, join('bob')),
        store.apply(ROOM, {
          kind: 'message',
          from: 'ada',
          message: { type: 'set_ready', ready: true },
          at: 0,
        }),
      ]);

      const held = await store.read(ROOM);
      expect(held.state.players.map((player) => player.name).sort()).toEqual([
        'ada',
        'bob',
      ]);
      expect(held.state.players.find((player) => player.name === 'ada')?.ready).toBe(
        true,
      );
    });
  });

  // D5 — a dropped socket is not a departure, so it is `evict` that ends a room
  // now. The grace window between the two is the transport's.
  describe('C1.8 — the room ends when the last player is evicted', () => {
    it('keeps a room whose last player merely dropped', async () => {
      await store.apply(ROOM, join('ada'));

      const applied = await store.apply(ROOM, leave('ada'));
      expect(applied.effects.map((effect) => effect.kind)).not.toContain('close_room');
      expect((await store.read(ROOM)).state.players).toHaveLength(1);
    });

    it('forgets the key entirely', async () => {
      await store.apply(ROOM, join('ada'));

      const applied = await store.apply(ROOM, evict('ada'));
      expect(applied.effects.map((effect) => effect.kind)).toContain('close_room');

      expect(await redis.client.exists(roomKey(NAMESPACE, ROOM))).toBe(0);
      // And a read after it is an empty room, not a half-deleted one.
      expect((await store.read(ROOM)).revision).toBe(0);
    });

    it('keeps the room while somebody is still in it', async () => {
      await store.apply(ROOM, join('ada'));
      await store.apply(ROOM, join('bob'));

      await store.apply(ROOM, evict('ada'));

      expect(await redis.client.exists(roomKey(NAMESPACE, ROOM))).toBe(1);
      expect((await store.read(ROOM)).state.players.map((p) => p.name)).toEqual(['bob']);
    });

    // The delete is guarded by the same revision as a write. Somebody joining
    // between the decision and the delete must not land in a room being
    // forgotten — they retry, and the room survives with them in it.
    it('does not forget a room somebody joined in the meantime', async () => {
      await store.apply(ROOM, join('ada'));

      await Promise.all([
        store.apply(ROOM, evict('ada')),
        store.apply(ROOM, join('bob')),
      ]);

      const held = await store.read(ROOM);
      const names = held.state.players.map((player) => player.name);
      // Whichever landed first, the outcome is consistent: either bob is in a
      // live room, or the room closed and bob's join rebuilt it around him.
      expect(names).toEqual(['bob']);
    });
  });

  describe('D4 — a room nobody touches does not live for ever', () => {
    it('sets an expiry, and pushes it back on every event', async () => {
      const short = createRoomStore({
        redis: redis.redis,
        namespace: NAMESPACE,
        idleSeconds: 60,
      });

      await short.apply(ROOM, join('ada'));
      const first = await redis.client.pTTL(roomKey(NAMESPACE, ROOM));
      expect(first).toBeGreaterThan(0);
      expect(first).toBeLessThanOrEqual(60_000);

      await short.apply(ROOM, join('bob'));
      const refreshed = await redis.client.pTTL(roomKey(NAMESPACE, ROOM));
      expect(refreshed).toBeGreaterThanOrEqual(first - 1000);
    });

    it('starts a room afresh once its key has expired', async () => {
      const instant = createRoomStore({
        redis: redis.redis,
        namespace: NAMESPACE,
        idleSeconds: 0,
      });

      await instant.apply(ROOM, join('ada'));

      // A zero TTL is a key already gone: the room is not there to read.
      expect((await instant.read(ROOM)).revision).toBe(0);
      expect((await instant.read(ROOM)).state).toEqual(emptyRoom());
    });
  });

  describe('a state Redis hands back that is not one', () => {
    // Only this service writes these, so an unreadable value is a bug here
    // rather than an attack — but it would otherwise reach `reduceRoom` as
    // rubbish and produce a room whose phase is `undefined`.
    it('is treated as no room at all rather than fed to the rules', async () => {
      await redis.client.hSet(roomKey(NAMESPACE, ROOM), {
        revision: '4',
        state: 'not json',
      });

      const held = await store.read(ROOM);
      expect(held.revision).toBe(0);
      expect(held.state).toEqual(emptyRoom());
    });

    it('is refused even when it parses but is not a room', async () => {
      await redis.client.hSet(roomKey(NAMESPACE, ROOM), {
        revision: '4',
        state: JSON.stringify({ phase: 'lobby' }),
      });

      expect((await store.read(ROOM)).state).toEqual(emptyRoom());
    });
  });
});

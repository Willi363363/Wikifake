// 4.8's criteria: two creations yield distinct six-character codes, and hitting
// the cap returns 503.
//
// The interesting half is what "hitting the cap" now means. The current registry
// is a dictionary in one process and its rooms vanish with their last player; a
// row does not. Counting every room ever created would turn a memory guard into
// a permanent one — the two-hundredth room ever opened would be the last — so
// the count is bounded by activity, and this file is where that bound is pinned.
import { insertRoom, selectOpenRoomCount, selectRoom } from '@wikifake/db';
import {
  DEFAULT_TIME_LIMIT,
  MAX_OPEN_ROOMS,
  ROOM_IDLE_LIMIT_SECONDS,
} from '@wikifake/domain';
import { roomCode } from '@wikifake/protocol';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { backdateRooms, type TestDatabase } from '@wikifake/db/testing';

import { handleCreateRoom, randomCode } from '../../../../src/game/rooms.js';
import {
  openWebTestDatabase,
  webTestDatabaseUrl,
} from '../../../../src/testing/database.js';
import type { RoomsContext } from '../../../../src/game/rooms.js';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const NOW = new Date('2026-08-25T12:00:00.000Z');

describe.skipIf(url === null)('4.8 — POST /api/multiplayer/create', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openWebTestDatabase();
  });
  afterAll(async () => {
    await store.close();
  });
  beforeEach(async () => {
    await store.truncate();
  });

  const context = (overrides: Partial<RoomsContext> = {}): RoomsContext => ({
    db: store.db,
    code: randomCode,
    now: () => NOW,
    ...overrides,
  });

  const create = (
    overrides: Partial<RoomsContext> = {},
    body?: unknown,
  ): Promise<Response> =>
    handleCreateRoom(
      context(overrides),
      new Request(`${BASE}/api/multiplayer/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        ...(body === undefined
          ? {}
          : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
      }),
    );

  const codeOf = async (response: Response): Promise<string> =>
    ((await response.json()) as { roomCode: string }).roomCode;

  /** Opens `count` rooms directly, at a given moment. */
  async function fill(count: number, at: Date): Promise<void> {
    for (let at_ = 0; at_ < count; at_ += 1) {
      const code = String(at_).padStart(6, '0');
      await insertRoom(store.db, { code, timeLimit: DEFAULT_TIME_LIMIT });
    }
    // `updatedAt` defaults to now(); the rooms this helper opens are made to
    // look as old as the test needs them to be.
    await backdateRooms(store.db, at);
  }

  describe('C5.6 — a code nobody else holds', () => {
    // The criterion.
    it('gives two creations two distinct six-character codes', async () => {
      const first = await codeOf(await create());
      const second = await codeOf(await create());

      expect(first).not.toBe(second);
      for (const code of [first, second]) {
        expect(code).toHaveLength(6);
        expect(roomCode.safeParse(code).success).toBe(true);
      }
    });

    it('draws codes the contract accepts, every time', () => {
      for (let draw = 0; draw < 200; draw += 1) {
        expect(roomCode.safeParse(randomCode()).success).toBe(true);
      }
    });

    // Uniqueness is the primary key, not a lookup. `_new_code` checks the
    // dictionary before inserting, and two requests drawing the same code a
    // microsecond apart both find it free — one then overwrites a room in play.
    it('draws again when the code it drew is taken', async () => {
      const drawn = ['AAAAAA', 'AAAAAA', 'BBBBBB'];
      let at = 0;
      const code = (): string => drawn[Math.min(at++, drawn.length - 1)] as string;

      expect(await codeOf(await create({ code }))).toBe('AAAAAA');
      // The second request draws the same code, is refused by the key, and
      // draws again rather than overwriting the first room.
      expect(await codeOf(await create({ code }))).toBe('BBBBBB');
      expect(at).toBe(3);
    });

    it('gives up with a 503 when the draw keeps colliding', async () => {
      const response = await create({ code: () => 'AAAAAA' });
      expect(response.status).toBe(200);

      // Fifty collisions in a row is a broken random source, not a full
      // registry — but the caller can do nothing with the distinction.
      const again = await create({ code: () => 'AAAAAA' });
      expect(again.status).toBe(503);
      expect(await again.json()).toMatchObject({ code: 'room_capacity_reached' });
    });

    it('writes a room ready to be joined', async () => {
      const code = await codeOf(await create());
      const [opened] = await selectRoom(store.db, code);

      expect(opened).toMatchObject({
        code,
        phase: 'lobby',
        timeLimit: DEFAULT_TIME_LIMIT,
        withItems: true,
        // Nobody is in it yet, so nobody is host. Phase 5 promotes the first
        // arrival.
        hostName: null,
      });
    });
  });

  describe('C5.6 — the cap', () => {
    // The criterion.
    it('answers 503 once the cap is reached', async () => {
      await fill(MAX_OPEN_ROOMS, NOW);

      const response = await create();
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: 'room_capacity_reached' });
    });

    it('still opens a room one below the cap', async () => {
      await fill(MAX_OPEN_ROOMS - 1, NOW);
      expect((await create()).status).toBe(200);
    });

    // The consequence of rooms being rows. Without this, the two-hundredth room
    // ever opened would be the last one this deployment ever opens.
    it('stops counting a room nobody has touched for an hour', async () => {
      const longAgo = new Date(NOW.getTime() - (ROOM_IDLE_LIMIT_SECONDS + 60) * 1000);
      await fill(MAX_OPEN_ROOMS, longAgo);

      const response = await create();
      expect(response.status).toBe(200);

      // The idle rooms are still rows — phase 5 reaps them — they simply no
      // longer hold a slot.
      const [open] = await selectOpenRoomCount(store.db, new Date(0));
      expect(open?.open).toBe(MAX_OPEN_ROOMS + 1);
    });

    it('still counts a room touched just inside the limit', async () => {
      const recent = new Date(NOW.getTime() - (ROOM_IDLE_LIMIT_SECONDS - 60) * 1000);
      await fill(MAX_OPEN_ROOMS, recent);

      expect((await create()).status).toBe(503);
    });
  });

  describe('the body', () => {
    it('needs none at all', async () => {
      expect((await create()).status).toBe(200);
      expect((await create({}, {})).status).toBe(200);
    });

    it('refuses one that is not an object', async () => {
      const response = await create({}, '"nope"');
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: 'bad_json' });
    });
  });
});

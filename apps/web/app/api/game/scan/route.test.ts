// 4.5's criterion for the scanner: it returns `null` after exhaustion, and it
// never points twice at the same paragraph.
//
// C1.6 says the item is resolved by the server, and the reason is not
// cosmetic: the client does not hold the solution, so a client-side scanner is
// either a lie or a leak. What is proved here is that the "already shown" list
// survives the request that produced it — the current server keeps it in a
// per-room dictionary that the normal round-start path never purges, which is
// D2.
import { selectItemUses, selectParticipantsInProgress } from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestDatabase } from '@wikifake/db/testing';

import { createAuth } from '../../../../src/auth/auth.js';
import { handleScan } from '../../../../src/game/scan.js';
import { handleStart } from '../../../../src/game/start.js';
import {
  openWebTestDatabase,
  webTestDatabaseUrl,
} from '../../../../src/testing/database.js';
import {
  cookieFrom,
  falsifier,
  wikipedia,
  HINT,
  ORIGINAL,
  PAGE,
  PARAGRAPHS,
  SEARCH,
  TRUTH,
} from '../../../../src/testing/round.js';
import type { SessionContext } from '../../../../src/game/session.js';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

/** Every paragraph is falsified by the mocked model, so the fakes are 1, 2, 3. */
const FAKES = PARAGRAPHS.map((_text, at) => at + 1);

interface Player {
  readonly sessionId: string;
  readonly cookie: string;
}

describe.skipIf(url === null)('4.5 — POST /api/game/scan', () => {
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

  /** A fresh context per request: nothing is carried but the database. */
  const context = (): SessionContext => ({
    auth: createAuth({ db: store.db, secret: SECRET, baseURL: BASE }),
    db: store.db,
  });

  async function play(): Promise<Player> {
    const started = await handleStart(
      {
        auth: createAuth({ db: store.db, secret: SECRET, baseURL: BASE }),
        round: {
          db: store.db,
          cache: null,
          model: falsifier(),
          wiki: { language: 'fr', userAgent: 'WikiFake/test (suite)' },
          transport: wikipedia([SEARCH, PAGE]),
          seed: () => 7,
        },
      },
      new Request(`${BASE}/api/game/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ topic: 'chat' }),
      }),
    );
    expect(started.status).toBe(200);

    const { sessionId, totalFakes } = (await started.json()) as {
      sessionId: string;
      totalFakes: number;
    };
    // The fixture's premise: three paragraphs, three fakes.
    expect(totalFakes).toBe(FAKES.length);
    return { sessionId, cookie: cookieFrom(started) };
  }

  const ask = (body: unknown, cookie?: string): Promise<Response> =>
    handleScan(
      context(),
      new Request(`${BASE}/api/game/scan`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie === undefined ? {} : { cookie }),
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );

  const scan = async (player: Player, marked: number[] = []): Promise<number | null> => {
    const response = await ask({ sessionId: player.sessionId, marked }, player.cookie);
    expect(response.status).toBe(200);
    return ((await response.json()) as { paragraphIndex: number | null }).paragraphIndex;
  };

  describe('C1.6 — a real fake, not yet designated', () => {
    it('points at a paragraph that really is falsified', async () => {
      const player = await play();
      expect(FAKES).toContain(await scan(player));
    });

    // The half a count of uses could not reproduce: what it may answer next
    // depends on what it answered before.
    it('never points at the same paragraph twice', async () => {
      const player = await play();
      const seen = [await scan(player), await scan(player), await scan(player)];

      expect(seen).toEqual(FAKES);
      expect(new Set(seen).size).toBe(FAKES.length);
    });

    it('skips what the player has already marked', async () => {
      const player = await play();
      // The lowest fake is 1; marking it moves the answer on.
      expect(await scan(player, [1])).toBe(2);
    });

    // The criterion.
    it('answers null once there is nothing left to point at', async () => {
      const player = await play();
      for (const _ of FAKES) await scan(player);

      expect(await scan(player)).toBeNull();
      // And keeps answering null, rather than starting over.
      expect(await scan(player)).toBeNull();
    });

    it('answers null when the player has marked everything', async () => {
      const player = await play();
      expect(await scan(player, FAKES)).toBeNull();
    });

    // The list is in `item_use`, not in a dictionary: a context built from
    // scratch — which is what a redeployment is — knows what was already shown.
    it('remembers designations across a rebuilt handler', async () => {
      const player = await play();
      expect(await scan(player)).toBe(1);
      expect(await scan(player)).toBe(2);

      const uses = await selectItemUses(store.db, player.sessionId);
      expect(uses.map((row) => row.itemId)).toEqual(['SCANNER', 'SCANNER']);
      expect(uses.every((row) => row.targetId === null)).toBe(true);
    });

    // Two clicks landing at once must not be answered with the same paragraph.
    it('gives two racing requests two different paragraphs', async () => {
      const player = await play();
      const body = { sessionId: player.sessionId, marked: [] };

      const [first, second] = await Promise.all([
        ask(body, player.cookie),
        ask(body, player.cookie),
      ]);

      const answers = [
        ((await first.json()) as { paragraphIndex: number | null }).paragraphIndex,
        ((await second.json()) as { paragraphIndex: number | null }).paragraphIndex,
      ];
      expect(new Set(answers).size).toBe(2);
    });
  });

  describe('what the answer carries', () => {
    it('carries an index and nothing else', async () => {
      const player = await play();
      const response = await ask(
        { sessionId: player.sessionId, marked: [] },
        player.cookie,
      );
      const body = await response.text();

      expect(Object.keys(JSON.parse(body) as object)).toEqual(['paragraphIndex']);
      for (const marker of [TRUTH, HINT, ORIGINAL]) {
        expect(body, `value "${marker}" survived`).not.toContain(marker);
      }
    });
  });

  describe('when the scan is not the caller’s to make', () => {
    it('refuses a session that belongs to somebody else', async () => {
      const owner = await play();
      const stranger = await play();

      const response = await ask(
        { sessionId: owner.sessionId, marked: [] },
        stranger.cookie,
      );
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'session_not_found' });

      // And nothing was recorded against the round they poked at.
      const [player] = await selectParticipantsInProgress(store.db, owner.sessionId);
      expect(player).toBeDefined();
      expect(await selectItemUses(store.db, owner.sessionId)).toEqual([]);
    });

    it('refuses a caller with no session at all', async () => {
      const player = await play();
      const response = await ask({ sessionId: player.sessionId, marked: [] });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'session_not_found' });
    });

    it('answers 400 to a body it cannot read', async () => {
      const player = await play();

      expect((await ask('{ nope', player.cookie)).status).toBe(400);
      // C3.3 — paragraph indices are 1-based, so 0 is not a mark.
      expect(
        (await ask({ sessionId: player.sessionId, marked: [0] }, player.cookie)).status,
      ).toBe(400);
    });
  });
});

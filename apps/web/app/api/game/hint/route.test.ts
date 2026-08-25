// 4.5's criterion for hints: the monotonicity and no-re-billing cases of C1.4
// pass **through the API**, not only through the rules.
//
// That distinction is the point of the file. `@wikifake/domain` already proves
// the ledger cannot double-charge; what is proved here is that the ledger a
// request works from is the one the database holds — because the current server
// keeps it in a dictionary in a process, and a restart hands the player back
// every hint they paid for, free.
import {
  isMonotonic,
  selectHintPurchases,
  selectParticipantsInProgress,
} from '@wikifake/db';
import { HINT_COST, REVEAL_COST } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestDatabase } from '@wikifake/db/testing';

import { createAuth } from '../../../../src/auth/auth.js';
import { handleHint } from '../../../../src/game/hint.js';
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
  PAGE,
  SEARCH,
  TRUTH,
} from '../../../../src/testing/round.js';
import type { SessionContext } from '../../../../src/game/session.js';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

interface Player {
  readonly sessionId: string;
  readonly cookie: string;
}

describe.skipIf(url === null)('4.5 — POST /api/game/hint', () => {
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

  /**
   * A fresh context every time, deliberately.
   *
   * Nothing is carried between requests but the database, which is the guarantee
   * under test: a handler that remembered a ledger would keep passing these
   * assertions and lose every purchase on the next deployment.
   */
  const context = (): SessionContext => ({
    auth: createAuth({ db: store.db, secret: SECRET, baseURL: BASE }),
    db: store.db,
  });

  /** Starts a solo round and returns the handle and the cookie that owns it. */
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

    const { sessionId } = (await started.json()) as { sessionId: string };
    return { sessionId, cookie: cookieFrom(started) };
  }

  /** The participant row a solo round has exactly one of. */
  async function onlyPlayer(player: Player): Promise<string> {
    const [row] = await selectParticipantsInProgress(store.db, player.sessionId);
    if (row === undefined) throw new Error('the round has no participant');
    return row.id;
  }

  const ask = (body: unknown, cookie?: string): Promise<Response> =>
    handleHint(
      context(),
      new Request(`${BASE}/api/game/hint`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie === undefined ? {} : { cookie }),
        },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      }),
    );

  describe('C1.4 — billed on call, and only once', () => {
    it('charges a nudge and reveals nothing', async () => {
      const player = await play();
      const response = await ask(
        { sessionId: player.sessionId, falseInfoNumber: 1, level: 1 },
        player.cookie,
      );

      expect(response.status).toBe(200);
      const body = await response.text();

      // The nudge, and the truth is not in the payload at all: a level-1 grant
      // has nowhere to put it, which is C1.4 holding by shape.
      expect(body).toContain(HINT);
      expect(body).not.toContain(TRUTH);
      expect(JSON.parse(body)).toMatchObject({
        falseInfoNumber: 1,
        charged: HINT_COST,
        hintPenalty: HINT_COST,
        grant: { level: 1 },
      });
    });

    // C2.2 — non-cumulative. Level 2 costs 200 in total, not 250.
    it('charges the difference when the reveal follows the nudge', async () => {
      const player = await play();
      await ask(
        { sessionId: player.sessionId, falseInfoNumber: 1, level: 1 },
        player.cookie,
      );

      const reveal = await ask(
        { sessionId: player.sessionId, falseInfoNumber: 1, level: 2 },
        player.cookie,
      );
      const body = (await reveal.json()) as { charged: number; hintPenalty: number };

      expect(body.charged).toBe(REVEAL_COST - HINT_COST);
      expect(body.hintPenalty).toBe(REVEAL_COST);
    });

    it('carries the truth once the reveal is paid for', async () => {
      const player = await play();
      const reveal = await ask(
        { sessionId: player.sessionId, falseInfoNumber: 1, level: 2 },
        player.cookie,
      );

      const body = await reveal.text();
      expect(body).toContain(TRUTH);
      expect(JSON.parse(body)).toMatchObject({
        charged: REVEAL_COST,
        grant: { level: 2, paragraphIndex: 1 },
      });
    });

    // The criterion, literally: level 2 unlocked, then level 1 asked for again.
    it('answers a later nudge with the reveal, for nothing', async () => {
      const player = await play();
      await ask(
        { sessionId: player.sessionId, falseInfoNumber: 1, level: 2 },
        player.cookie,
      );

      const again = await ask(
        { sessionId: player.sessionId, falseInfoNumber: 1, level: 1 },
        player.cookie,
      );
      const body = (await again.json()) as {
        charged: number;
        hintPenalty: number;
        grant: { level: number };
      };

      expect(body.grant.level).toBe(2);
      expect(body.charged).toBe(0);
      expect(body.hintPenalty).toBe(REVEAL_COST);
    });

    it('does not bill the same reveal twice', async () => {
      const player = await play();
      await ask(
        { sessionId: player.sessionId, falseInfoNumber: 1, level: 2 },
        player.cookie,
      );
      const repeat = await ask(
        { sessionId: player.sessionId, falseInfoNumber: 1, level: 2 },
        player.cookie,
      );

      expect((await repeat.json()) as { charged: number }).toMatchObject({
        charged: 0,
      });
    });

    // Two clicks landing at once read the same empty ledger and both decide to
    // charge. Exactly one row lands, and the loser is served the hint for free
    // rather than an error.
    it('bills once when two identical requests race', async () => {
      const player = await play();
      const body = { sessionId: player.sessionId, falseInfoNumber: 2, level: 2 };

      const [first, second] = await Promise.all([
        ask(body, player.cookie),
        ask(body, player.cookie),
      ]);

      expect([first.status, second.status]).toEqual([200, 200]);
      const charges = [
        ((await first.json()) as { charged: number }).charged,
        ((await second.json()) as { charged: number }).charged,
      ];
      expect(charges.filter((charged) => charged > 0)).toHaveLength(1);
    });
  });

  describe('what the record says afterwards', () => {
    it('holds one row per level actually billed, and it is monotonic', async () => {
      const player = await play();
      for (const level of [1, 2, 1, 2] as const) {
        await ask(
          { sessionId: player.sessionId, falseInfoNumber: 3, level },
          player.cookie,
        );
      }

      const purchases = await selectHintPurchases(store.db, await onlyPlayer(player));

      expect(purchases.map((row) => row.level)).toEqual([1, 2]);
      expect(purchases.map((row) => row.charged)).toEqual([
        HINT_COST,
        REVEAL_COST - HINT_COST,
      ]);
      expect(isMonotonic(purchases)).toBe(true);
    });

    // The reason the ledger is rebuilt on every request rather than held: this
    // is what a redeployment looks like from the database's point of view.
    it('still knows what was paid for after everything is rebuilt', async () => {
      const player = await play();
      await ask(
        { sessionId: player.sessionId, falseInfoNumber: 1, level: 2 },
        player.cookie,
      );

      // A brand-new context: new auth instance, no memory of anything.
      const afterRestart = await ask(
        { sessionId: player.sessionId, falseInfoNumber: 1, level: 2 },
        player.cookie,
      );
      expect((await afterRestart.json()) as { charged: number }).toMatchObject({
        charged: 0,
      });
    });
  });

  describe('when the hint is not available', () => {
    it('answers 404 for a number the round does not have', async () => {
      const player = await play();
      const response = await ask(
        { sessionId: player.sessionId, falseInfoNumber: 9, level: 1 },
        player.cookie,
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'hint_not_found' });
    });

    it('refuses a session that is not the caller’s, and says nothing about it', async () => {
      const owner = await play();
      const stranger = await play();

      const response = await ask(
        { sessionId: owner.sessionId, falseInfoNumber: 1, level: 2 },
        stranger.cookie,
      );

      expect(response.status).toBe(404);
      const body = await response.text();
      expect(JSON.parse(body)).toMatchObject({ code: 'session_not_found' });
      // Not a word of the round they asked about.
      expect(body).not.toContain(TRUTH);
      expect(body).not.toContain(HINT);
    });

    it('refuses a caller with no session at all', async () => {
      const player = await play();
      const response = await ask({
        sessionId: player.sessionId,
        falseInfoNumber: 1,
        level: 2,
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'session_not_found' });
    });

    it('refuses a handle that is not one, without asking the database', async () => {
      const player = await play();
      const response = await ask(
        { sessionId: 'not-a-game-identifier', falseInfoNumber: 1, level: 1 },
        player.cookie,
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'session_not_found' });
    });

    it('answers 400 to a body it cannot read', async () => {
      const player = await play();

      expect((await ask('{ nope', player.cookie)).status).toBe(400);
      expect(
        (await ask({ sessionId: player.sessionId, falseInfoNumber: 0 }, player.cookie))
          .status,
      ).toBe(400);
      expect(
        (
          await ask(
            { sessionId: player.sessionId, falseInfoNumber: 1, level: 3 },
            player.cookie,
          )
        ).status,
      ).toBe(400);
    });

    it('bills nothing on any of those', async () => {
      const player = await play();
      await ask(
        { sessionId: player.sessionId, falseInfoNumber: 9, level: 1 },
        player.cookie,
      );
      await ask({ sessionId: player.sessionId, falseInfoNumber: 1, level: 1 });

      expect(await selectHintPurchases(store.db, await onlyPlayer(player))).toEqual([]);
    });
  });
});

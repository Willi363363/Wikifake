// Phase 4's exit gate: a solo game plays end to end through the API, without a
// UI, with or without an account.
//
// The individual routes have their own suites, and each proves its own
// guarantee. What this one proves is that they compose: the handle `start`
// returns is the handle `hint`, `scan` and `submit` accept; the penalty `hint`
// billed is the penalty `submit` subtracts; and the solution arrives once, at
// the end, having been absent from everything before it.
//
// Every request gets a fresh context. Nothing is carried between them but the
// database and a cookie — which is the property the current server does not
// have, and the reason a redeployment mid-round loses the game.
import { selectGameInProgress, selectLeaderboard } from '@wikifake/db';
import {
  HINT_COST,
  PER_FALSE_POSITIVE,
  PER_TRUE_POSITIVE,
  REVEAL_COST,
} from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestDatabase } from '@wikifake/db/testing';

import { createAuth } from '../auth/auth.js';
import { handleHint } from './hint.js';
import { handleScan } from './scan.js';
import { handleStart } from './start.js';
import { handleSubmit } from './submit.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
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
} from '../testing/round.js';
import type { SessionContext } from './session.js';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';
const TIME_LIMIT = 300;

/** Every paragraph is falsified by the mocked model: the fakes are 1, 2 and 3. */
const FAKES = PARAGRAPHS.map((_text, at) => at + 1);
const NOT_A_FAKE = PARAGRAPHS.length + 1;

describe.skipIf(url === null)(
  'phase 4 — a solo game, end to end, through the API',
  () => {
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

    const auth = () => createAuth({ db: store.db, secret: SECRET, baseURL: BASE });
    const session = (): SessionContext => ({ auth: auth(), db: store.db });

    const post = (path: string, body: unknown, cookie?: string): Request =>
      new Request(`${BASE}/api/game/${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie === undefined ? {} : { cookie }),
        },
        body: JSON.stringify(body),
      });

    /**
     * The whole journey, and every payload it produced along the way.
     *
     * `cookie` is what a browser would carry: absent on the first request when the
     * player has no account, and whatever the round hands back afterwards.
     */
    async function playThrough(cookie?: string) {
      const started = await handleStart(
        {
          auth: auth(),
          round: {
            db: store.db,
            cache: null,
            model: falsifier(),
            wiki: { language: 'fr', userAgent: 'WikiFake/test (suite)' },
            transport: wikipedia([SEARCH, PAGE]),
            seed: () => 7,
          },
        },
        post('start', { topic: 'chat', timeLimit: TIME_LIMIT }, cookie),
      );
      expect(started.status).toBe(200);

      const startBody = await started.text();
      const { sessionId, totalFakes } = JSON.parse(startBody) as {
        sessionId: string;
        totalFakes: number;
      };
      const carried = cookie ?? cookieFrom(started);

      const scanned = await handleScan(
        session(),
        post('scan', { sessionId, marked: [] }, carried),
      );
      const scanBody = await scanned.text();
      const { paragraphIndex } = JSON.parse(scanBody) as {
        paragraphIndex: number | null;
      };

      const nudged = await handleHint(
        session(),
        post('hint', { sessionId, falseInfoNumber: 1, level: 1 }, carried),
      );
      const nudgeBody = await nudged.text();

      const revealed = await handleHint(
        session(),
        post('hint', { sessionId, falseInfoNumber: 1, level: 2 }, carried),
      );
      const revealBody = await revealed.text();

      // The scanner pointed at one, the reveal named another: a player would mark
      // those and guess at the rest. This one also marks a paragraph that is not
      // falsified, so the round has something to get wrong.
      const marked = [paragraphIndex as number, ...FAKES.slice(1), NOT_A_FAKE];

      const { startedAt } = (await selectGameInProgress(store.db, sessionId))[0] ?? {};
      const submitted = await handleSubmit(
        {
          ...session(),
          now: () => new Date((startedAt as Date).getTime() + 100 * 1000),
        },
        post('submit', { sessionId, marked }, carried),
      );
      const submitBody = await submitted.text();

      return {
        sessionId,
        totalFakes,
        cookie: carried,
        before: [startBody, scanBody, nudgeBody],
        revealBody,
        submitBody,
        submitted,
        scannedAt: paragraphIndex,
      };
    }

    it('plays through without an account', async () => {
      const journey = await playThrough();

      // The article, and the count of fakes. Never which ones.
      expect(journey.totalFakes).toBe(FAKES.length);
      // The scanner designated a real one.
      expect(FAKES).toContain(journey.scannedAt);

      // C1.2 — nothing before the reveal carries the truth, and the reveal carries
      // only its own. The debrief carries the lot.
      for (const payload of journey.before) {
        expect(payload).not.toContain(TRUTH);
        expect(payload).not.toContain(ORIGINAL);
      }
      expect(journey.revealBody).toContain(`${TRUTH}-0`);
      expect(journey.revealBody).not.toContain(`${TRUTH}-1`);

      expect(journey.submitted.status).toBe(200);
      const debrief = JSON.parse(journey.submitBody) as {
        score: number;
        breakdown: { truePositives: number; falsePositives: number; hintPenalty: number };
        solution: { paragraphIndex: number }[];
      };
      expect(journey.submitBody).toContain(TRUTH);
      expect(journey.submitBody).toContain(HINT);
      expect(debrief.solution.map((position) => position.paragraphIndex)).toEqual(FAKES);

      // Three fakes marked, one clean paragraph marked, one reveal bought,
      // 200 seconds left of 300: 3x150 - 80 - 200 + 100 = 270.
      expect(debrief.breakdown).toMatchObject({
        truePositives: FAKES.length,
        falsePositives: 1,
        // C2.2 — the nudge then the reveal costs 200 in total, not 250.
        hintPenalty: REVEAL_COST,
      });
      expect(debrief.score).toBe(
        FAKES.length * PER_TRUE_POSITIVE - PER_FALSE_POSITIVE - REVEAL_COST + 100,
      );
      expect(REVEAL_COST).toBeGreaterThan(HINT_COST);

      // And the round is settled: the standing is written, the game is over.
      const [standing] = await selectLeaderboard(store.db, journey.sessionId);
      expect(standing?.score).toBe(debrief.score);
      const [round] = await selectGameInProgress(store.db, journey.sessionId);
      expect(round?.endedAt).not.toBeNull();
    });

    it('plays through with an account, and the game is the account’s', async () => {
      const instance = auth();
      const signedUp = await instance.handler(
        new Request(`${BASE}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Élise',
            email: 'elise@example.test',
            password: 'un-mot-de-passe-assez-long',
          }),
        }),
      );
      expect(signedUp.status).toBe(200);
      const account = (await signedUp.json()) as { user: { id: string } };

      const journey = await playThrough(cookieFrom(signedUp));
      expect(journey.submitted.status).toBe(200);

      const [standing] = await selectLeaderboard(store.db, journey.sessionId);
      expect(standing?.userId).toBe(account.user.id);
      expect(standing?.score).not.toBeNull();
    });

    // Two players, two rounds, nothing shared. The current server keeps solo
    // sessions in one process-wide dictionary; this is what makes a second
    // instance safe.
    it('keeps two players’ rounds apart', async () => {
      const first = await playThrough();
      const second = await playThrough();

      expect(first.sessionId).not.toBe(second.sessionId);

      const stranger = await handleHint(
        session(),
        post(
          'hint',
          { sessionId: first.sessionId, falseInfoNumber: 1, level: 2 },
          second.cookie,
        ),
      );
      expect(stranger.status).toBe(404);
      expect(await stranger.text()).not.toContain(TRUTH);
    });
  },
);

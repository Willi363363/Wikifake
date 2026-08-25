// 4.6's criteria: the scoring scale reaches the player through the API, and a
// penalty declared by the client has no effect on the breakdown.
//
// The second one is stronger than "ignored". `submitRequest` carries a session
// handle and a list of marked paragraphs and has nothing else — so the test
// sends `hintsUsed: 9`, `hintPenalty: 9999` and `scoreStolen: -100000` as extra
// keys and watches the decoder drop them. A client cannot declare a penalty
// because the contract gives it nowhere to write one.
//
// On C2.5: the contract's reference case is `tp=3, fp=1, penalty=20, stolen=50,
// 200 s left of 300 → 400`, and **two of its terms cannot be produced through
// the solo API**. A hint costs 50 or 200, never 20, and nothing steals points
// when there is no rival. That tuple is pinned in
// `packages/domain/src/scoring.test.ts`; what is pinned here is that the API
// reaches the player with the same scale, on terms a solo round can actually
// reach.
import {
  selectAnswers,
  selectGameInProgress,
  selectLeaderboard,
  selectParticipantsInProgress,
} from '@wikifake/db';
import {
  HINT_COST,
  PER_FALSE_POSITIVE,
  PER_TRUE_POSITIVE,
  REVEAL_COST,
  scoreFor,
} from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestDatabase } from '@wikifake/db/testing';

import { createAuth } from '../../../../src/auth/auth.js';
import { handleHint } from '../../../../src/game/hint.js';
import { handleScan } from '../../../../src/game/scan.js';
import { handleStart } from '../../../../src/game/start.js';
import { handleSubmit } from '../../../../src/game/submit.js';
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
  PARAGRAPHS,
  SEARCH,
  TRUTH,
} from '../../../../src/testing/round.js';
import type { SessionContext } from '../../../../src/game/session.js';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

/** Every paragraph is falsified by the mocked model: the fakes are 1, 2 and 3. */
const FAKES = PARAGRAPHS.map((_text, at) => at + 1);
/** No such paragraph, so marking it is a false positive. */
const NOT_A_FAKE = PARAGRAPHS.length + 1;

const TIME_LIMIT = 300;

interface Player {
  readonly sessionId: string;
  readonly cookie: string;
  readonly startedAt: Date;
}

interface Result {
  readonly score: number;
  readonly breakdown: {
    truePositives: number;
    falsePositives: number;
    hintsUsed: number;
    hintPenalty: number;
    scoreStolen: number;
    timeBonus: number;
  };
  readonly solution: { paragraphIndex: number; explanation: string; hint: string }[];
}

describe.skipIf(url === null)('4.6 — POST /api/game/submit', () => {
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

  const session = (): SessionContext => ({
    auth: createAuth({ db: store.db, secret: SECRET, baseURL: BASE }),
    db: store.db,
  });

  const post = (path: string, body: unknown, cookie?: string): Request =>
    new Request(`${BASE}/api/game/${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie === undefined ? {} : { cookie }),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
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
      post('start', { topic: 'chat', timeLimit: TIME_LIMIT }),
    );
    expect(started.status).toBe(200);

    const { sessionId } = (await started.json()) as { sessionId: string };
    const [round] = await selectGameInProgress(store.db, sessionId);
    return {
      sessionId,
      cookie: cookieFrom(started),
      startedAt: round?.startedAt as Date,
    };
  }

  /** Submits `marked` after `elapsed` seconds of round. */
  const submit = (
    player: Player,
    marked: number[],
    elapsed = 0,
    body?: Record<string, unknown>,
  ): Promise<Response> =>
    handleSubmit(
      {
        ...session(),
        now: () => new Date(player.startedAt.getTime() + elapsed * 1000),
      },
      post('submit', { sessionId: player.sessionId, marked, ...body }, player.cookie),
    );

  describe('C2 — the scale reaches the player', () => {
    it('scores a round from the server’s own state', async () => {
      const player = await play();

      // One nudge: a penalty the server knows about because it billed it.
      const hinted = await handleHint(
        session(),
        post(
          'hint',
          { sessionId: player.sessionId, falseInfoNumber: 1, level: 1 },
          player.cookie,
        ),
      );
      expect(hinted.status).toBe(200);

      // tp = 3, fp = 1, hintPenalty = 50, stolen = 0, 200 s left of 300.
      const response = await submit(player, [...FAKES, NOT_A_FAKE], 100);
      expect(response.status).toBe(200);

      const result = (await response.json()) as Result;
      expect(result.breakdown).toEqual({
        truePositives: 3,
        falsePositives: 1,
        hintsUsed: 1,
        hintPenalty: HINT_COST,
        scoreStolen: 0,
        timeBonus: 100,
      });
      // 3x150 = 450, -1x80 = 370, -50 = 320, +100 = 420.
      expect(result.score).toBe(420);
    });

    // The breakdown and the total have to be the same arithmetic. A handler that
    // computed the score one way and reported the terms another would produce a
    // debrief that does not add up, and nothing above would notice.
    it('reports a breakdown its own total agrees with', async () => {
      const player = await play();
      await handleHint(
        session(),
        post(
          'hint',
          { sessionId: player.sessionId, falseInfoNumber: 2, level: 2 },
          player.cookie,
        ),
      );

      const result = (await (
        await submit(player, [1, 2, NOT_A_FAKE], 40)
      ).json()) as Result;

      expect(result.breakdown.hintPenalty).toBe(REVEAL_COST);
      expect(result.score).toBe(
        scoreFor({
          truePositives: result.breakdown.truePositives,
          falsePositives: result.breakdown.falsePositives,
          hintsUsed: result.breakdown.hintsUsed,
          hintPenalty: result.breakdown.hintPenalty,
          scoreStolen: result.breakdown.scoreStolen,
          timeLimitSeconds: TIME_LIMIT,
          elapsedSeconds: 40,
        }),
      );
      expect(result.score).toBe(
        2 * PER_TRUE_POSITIVE - PER_FALSE_POSITIVE - REVEAL_COST + 130,
      );
    });

    // C2.3 — the score can be negative, and is not clamped. Hiding it behind a
    // zero would hide what the reveals cost.
    it('lets a score go negative', async () => {
      const player = await play();
      for (const falseInfoNumber of [1, 2, 3]) {
        await handleHint(
          session(),
          post(
            'hint',
            { sessionId: player.sessionId, falseInfoNumber, level: 2 },
            player.cookie,
          ),
        );
      }

      const result = (await (await submit(player, [], TIME_LIMIT)).json()) as Result;
      expect(result.breakdown.hintPenalty).toBe(3 * REVEAL_COST);
      expect(result.score).toBe(-3 * REVEAL_COST);
    });

    // C2.3 — no time bonus past the limit.
    it('gives no time bonus to a round that ran over', async () => {
      const player = await play();
      const result = (await (
        await submit(player, FAKES, TIME_LIMIT + 60)
      ).json()) as Result;

      expect(result.breakdown.timeBonus).toBe(0);
      expect(result.score).toBe(3 * PER_TRUE_POSITIVE);
    });

    // D11 — `check_answer` counts a repeat as many times as it appears, so
    // marking one paragraph three times scored it three times.
    it('counts a paragraph marked three times once', async () => {
      const player = await play();
      const result = (await (await submit(player, [1, 1, 1], 0)).json()) as Result;

      expect(result.breakdown.truePositives).toBe(1);
      expect(result.score).toBe(PER_TRUE_POSITIVE + TIME_LIMIT / 2);
    });
  });

  describe('C1.3 — a client cannot declare its own penalty', () => {
    it('produces a breakdown of zero from a payload that claims otherwise', async () => {
      const player = await play();

      const result = (await (
        await submit(player, FAKES, TIME_LIMIT, {
          hintsUsed: 9,
          hintPenalty: 9999,
          scoreStolen: -100_000,
          timeBonus: 999_999,
          score: 1_000_000,
        })
      ).json()) as Result;

      expect(result.breakdown.hintsUsed).toBe(0);
      expect(result.breakdown.hintPenalty).toBe(0);
      expect(result.breakdown.scoreStolen).toBe(0);
      expect(result.breakdown.timeBonus).toBe(0);
      expect(result.score).toBe(3 * PER_TRUE_POSITIVE);
    });
  });

  describe('C1.2 — the solution arrives here, and only here', () => {
    it('carries every falsification in full', async () => {
      const player = await play();
      const response = await submit(player, [1], 0);
      const body = await response.text();

      expect(body).toContain(TRUTH);
      expect(body).toContain(HINT);
      expect((JSON.parse(body) as Result).solution.map((p) => p.paragraphIndex)).toEqual(
        FAKES,
      );
    });

    it('never arrives before, however the round is poked at', async () => {
      const player = await play();

      const scanned = await handleScan(
        session(),
        post('scan', { sessionId: player.sessionId, marked: [] }, player.cookie),
      );
      expect(await scanned.text()).not.toContain(TRUTH);

      const nudge = await handleHint(
        session(),
        post(
          'hint',
          { sessionId: player.sessionId, falseInfoNumber: 1, level: 1 },
          player.cookie,
        ),
      );
      expect(await nudge.text()).not.toContain(TRUTH);
    });
  });

  describe('what the round looks like afterwards', () => {
    it('writes the breakdown, the marks and the end of the game', async () => {
      const player = await play();
      await submit(player, [1, 2, 1, NOT_A_FAKE], 60);

      const [participant] = await selectParticipantsInProgress(
        store.db,
        player.sessionId,
      );
      expect(participant?.submittedAt).not.toBeNull();

      const [standing] = await selectLeaderboard(store.db, player.sessionId);
      expect(standing).toMatchObject({
        truePositives: 2,
        falsePositives: 1,
        hintPenalty: 0,
        timeBonus: 120,
      });

      // D11 again, in the record: one row per paragraph, however often marked.
      const marks = await selectAnswers(store.db, participant?.id as string);
      expect(marks.map((row) => row.paragraphIndex)).toEqual([1, 2, NOT_A_FAKE]);

      const [round] = await selectGameInProgress(store.db, player.sessionId);
      expect(round?.endedAt).not.toBeNull();
    });

    // A lost response, a double-click: the debrief a player was shown is the
    // debrief they keep. Regrading a minute later would quietly replace their
    // score with a smaller one, because the clock has moved.
    it('hands back the same grading rather than grading again', async () => {
      const player = await play();
      const first = (await (await submit(player, FAKES, 0)).json()) as Result;
      const again = (await (await submit(player, [], TIME_LIMIT)).json()) as Result;

      expect(again.score).toBe(first.score);
      expect(again.breakdown).toEqual(first.breakdown);
      expect(again.solution).toHaveLength(FAKES.length);
    });

    it('grades once when two submissions race', async () => {
      const player = await play();
      const [first, second] = await Promise.all([
        submit(player, FAKES, 0),
        submit(player, [], 0),
      ]);

      const results = [(await first.json()) as Result, (await second.json()) as Result];
      expect(results[0]?.score).toBe(results[1]?.score);

      const [standing] = await selectLeaderboard(store.db, player.sessionId);
      expect(standing?.score).toBe(results[0]?.score);
    });

    // C1.4, C1.6 — the round is over, so there is nothing left to buy.
    it('closes the round to hints and scans', async () => {
      const player = await play();
      await submit(player, FAKES, 0);

      const nudge = await handleHint(
        session(),
        post(
          'hint',
          { sessionId: player.sessionId, falseInfoNumber: 1, level: 1 },
          player.cookie,
        ),
      );
      expect(nudge.status).toBe(404);
      expect(await nudge.json()).toMatchObject({ code: 'session_not_found' });

      const scanned = await handleScan(
        session(),
        post('scan', { sessionId: player.sessionId, marked: [] }, player.cookie),
      );
      expect(scanned.status).toBe(404);
    });
  });

  describe('when the submission is not the caller’s to make', () => {
    it('refuses somebody else’s session, and reveals nothing', async () => {
      const owner = await play();
      const stranger = await play();

      const response = await handleSubmit(
        { ...session(), now: () => new Date() },
        post('submit', { sessionId: owner.sessionId, marked: [1] }, stranger.cookie),
      );

      expect(response.status).toBe(404);
      const body = await response.text();
      expect(JSON.parse(body)).toMatchObject({ code: 'session_not_found' });
      expect(body).not.toContain(TRUTH);

      const [round] = await selectGameInProgress(store.db, owner.sessionId);
      expect(round?.endedAt).toBeNull();
    });

    it('refuses a caller with no session at all', async () => {
      const player = await play();
      const response = await handleSubmit(
        { ...session(), now: () => new Date() },
        post('submit', { sessionId: player.sessionId, marked: [1] }),
      );

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain(TRUTH);
    });

    it('answers 400 to a body it cannot read', async () => {
      const player = await play();

      expect(
        (
          await handleSubmit(
            { ...session(), now: () => new Date() },
            post('submit', '{ nope', player.cookie),
          )
        ).status,
      ).toBe(400);
      // C3.3 — paragraph indices are 1-based.
      expect((await submit(player, [0], 0)).status).toBe(400);
    });
  });
});

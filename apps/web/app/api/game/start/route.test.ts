// 4.4's criterion, and it is the reason the step exists: the start payload
// carries the article and the **count** of falsifications, and nothing else.
// Checked by keys **and** by values, on the real handler — its parsing, its
// identification, its writes, its encoder — with a mocked model and a transport
// that never leaves the process.
//
// By values is the half that matters. The payload used to carry `positions`,
// `misinformations` and `original_text`, and a diff between the original and the
// falsified paragraph solved the game without reading it. A key-based test is
// fooled by a rename; a marker string in the model's answer is not.
// The ORM is deliberately absent from this application's dependencies — phase
// 2's exit gate: no free-form SQL outside `@wikifake/db`. Every read below has a
// name over there, and the ones about cost are the very queries `/api/usage` will
// answer with in step 4.7.
import {
  selectCostOfGame,
  selectFailuresByKind,
  selectGameCounts,
  selectGameInProgress,
  selectParticipantsInProgress,
  selectSolution,
  selectUserById,
} from '@wikifake/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TestDatabase } from '@wikifake/db/testing';
import type { ArticleCache, CachedArticle } from '@wikifake/article';

import { createAuth } from '../../../../src/auth/auth.js';
import { handleStart, type StartContext } from '../../../../src/game/start.js';
import {
  openWebTestDatabase,
  webTestDatabaseUrl,
} from '../../../../src/testing/database.js';
import {
  allKeys,
  cookieFrom,
  falsifier,
  refuser,
  wikipedia,
  HINT,
  ORIGINAL,
  PAGE,
  PARAGRAPHS,
  SEARCH,
  TRUTH,
} from '../../../../src/testing/round.js';
import type { RoundDependencies } from '../../../../src/game/round.js';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

const FORBIDDEN_KEYS = [
  'positions',
  'misinformations',
  'originalText',
  'original_text',
  'solution',
  'explanation',
  'hint',
  'hints',
  'falseStatement',
  'html',
];

describe.skipIf(url === null)('4.4 — POST /api/game/start', () => {
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

  /** The handler, wired to this test's database and to nothing on the network. */
  function context(overrides: Partial<RoundDependencies> = {}): StartContext {
    return {
      auth: createAuth({ db: store.db, secret: SECRET, baseURL: BASE }),
      round: {
        db: store.db,
        cache: null,
        model: falsifier(),
        wiki: { language: 'fr', userAgent: 'WikiFake/test (suite)' },
        transport: wikipedia([SEARCH, PAGE]),
        seed: () => 7,
        ...overrides,
      },
    };
  }

  const post = (body: unknown, cookie?: string): Request =>
    new Request(`${BASE}/api/game/start`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(cookie === undefined ? {} : { cookie }),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  describe('C1.1 — the solution stays on the server', () => {
    it('carries no forbidden key', async () => {
      const response = await handleStart(context(), post({ topic: 'chat' }));
      expect(response.status).toBe(200);

      const keys = allKeys(await response.json());
      for (const forbidden of FORBIDDEN_KEYS) {
        expect(keys, `key "${forbidden}" survived`).not.toContain(forbidden);
      }
    });

    it('carries no truth text, no hint text and no original paragraph', async () => {
      const response = await handleStart(context(), post({ topic: 'chat' }));
      const serialised = await response.text();

      for (const forbidden of [TRUTH, HINT, ORIGINAL]) {
        expect(serialised, `value "${forbidden}" survived`).not.toContain(forbidden);
      }
    });

    // Without this the two assertions above would pass on an empty payload, and
    // the strongest leak test in the repository would be measuring nothing.
    it('still serves the article and says how many fakes there are', async () => {
      const response = await handleStart(context(), post({ topic: 'chat' }));
      const payload = (await response.json()) as {
        paragraphs: string[];
        totalFakes: number;
      };

      expect(payload.paragraphs).toHaveLength(PARAGRAPHS.length);
      expect(payload.paragraphs.join(' ')).toContain('FAUX-');
      expect(payload.totalFakes).toBe(PARAGRAPHS.length);
    });

    // And the solution really exists, in the one place it is allowed to: a round
    // that leaked nothing because it generated nothing is not a round.
    it('keeps the whole solution in the database', async () => {
      const response = await handleStart(context(), post({ topic: 'chat' }));
      const { sessionId } = (await response.json()) as { sessionId: string };

      const solution = await selectSolution(store.db, sessionId);
      expect(solution).toHaveLength(PARAGRAPHS.length);
      expect(solution.map((position) => position.explanation).join(' ')).toContain(TRUTH);
      expect(solution.map((position) => position.hint).join(' ')).toContain(HINT);
      // The audit trail `game_position.original_text` exists for.
      expect(solution.map((position) => position.originalText).join(' ')).toContain(
        ORIGINAL,
      );
    });
  });

  describe('who is playing', () => {
    it('plays without an account, and hands back the identity it created', async () => {
      const response = await handleStart(context(), post({ topic: 'chat' }));
      expect(response.status).toBe(200);
      expect(cookieFrom(response)).not.toBe('');

      const { sessionId } = (await response.json()) as { sessionId: string };
      const [player] = await selectParticipantsInProgress(store.db, sessionId);
      expect(player?.userId).not.toBeNull();

      // A guest is an identity, not a nickname: that anonymous row is what makes
      // this game follow them into an account created afterwards (4.3).
      const [identity] = await selectUserById(store.db, player?.userId as string);
      expect(identity?.isAnonymous).toBe(true);
    });

    it('keeps the account of a player who has one', async () => {
      const instance = createAuth({ db: store.db, secret: SECRET, baseURL: BASE });
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
      const account = (await signedUp.json()) as { user: { id: string } };

      const response = await handleStart(
        { auth: instance, round: context().round },
        post({ topic: 'chat' }, cookieFrom(signedUp)),
      );
      expect(response.status).toBe(200);

      const { sessionId } = (await response.json()) as { sessionId: string };
      const [player] = await selectParticipantsInProgress(store.db, sessionId);
      expect(player?.userId).toBe(account.user.id);
      // No second identity was minted: a request that already carries a session
      // gets no new cookie, and a guest row would have come with one.
      expect(response.headers.getSetCookie()).toEqual([]);
    });
  });

  describe('the round it writes', () => {
    it('takes the round length it was given, and 300 seconds by default', async () => {
      const byDefault = (await (
        await handleStart(context(), post({ topic: 'chat' }))
      ).json()) as { sessionId: string; timeLimit: number };
      expect(byDefault.timeLimit).toBe(300);

      const chosen = (await (
        await handleStart(context(), post({ topic: 'chat', timeLimit: 120 }))
      ).json()) as { sessionId: string; timeLimit: number };
      expect(chosen.timeLimit).toBe(120);

      // Written down, not only announced: the time bonus of C2.1 is computed
      // from the stored limit, so a payload that says 120 over a row that says
      // 300 would score the player on a round they did not play.
      const [stored] = await selectGameInProgress(store.db, chosen.sessionId);
      expect(stored?.timeLimit).toBe(120);
      const [other] = await selectGameInProgress(store.db, byDefault.sessionId);
      expect(other?.timeLimit).toBe(300);
    });

    // C4.6 — a generated round is marked as generated. `/api/usage` divides by
    // this, and a round wrongly marked as reused makes generation look free.
    it('records the round as generated, with what it cost', async () => {
      const response = await handleStart(context(), post({ topic: 'chat' }));
      const { sessionId } = (await response.json()) as { sessionId: string };

      const [counts] = await selectGameCounts(store.db);
      expect(counts).toEqual({ generated: 1, fromCache: 0 });

      // The resolved page title, not what the player typed in lower case.
      const [round] = await selectGameInProgress(store.db, sessionId);
      expect(round?.topic).toBe('Chat');

      const [cost] = await selectCostOfGame(store.db, sessionId);
      expect(cost?.calls).toBe(1);
      expect(cost?.inputTokens).toBe(500);
      expect(cost?.outputTokens).toBe(90);
    });

    it('serves a cached article without calling the model', async () => {
      let putCalls = 0;
      const entry: CachedArticle = {
        article: {
          topic: 'Chat',
          paragraphs: [
            'Un paragraphe déjà falsifié, gardé en cache pour la prochaine fois.',
          ],
          totalFakes: 1,
          wikipediaUrl: 'https://fr.wikipedia.org/wiki/Chat',
        },
        solution: [
          {
            paragraphIndex: 1,
            falseInfoNumber: 1,
            falseStatement:
              'Un paragraphe déjà falsifié, gardé en cache pour la prochaine fois.',
            originalText: `${ORIGINAL}-cache`,
            explanation: `${TRUTH}-cache`,
            hint: `${HINT}-cache`,
          },
        ],
        html: '<p>déjà falsifié</p>',
      };
      const cache: ArticleCache = {
        get: () => Promise.resolve({ kind: 'hit', entry }),
        put: () => {
          putCalls += 1;
          return Promise.resolve({ kind: 'stored' });
        },
        stats: () => Promise.resolve(null),
      };

      const response = await handleStart(
        context({ cache, model: refuser(), transport: wikipedia([]) }),
        post({ topic: 'chat' }),
      );
      expect(response.status).toBe(200);
      // The leak assertion holds on the cached path too — it is the same encoder,
      // and this is the path that will serve most rounds once the cache is warm.
      expect(await response.text()).not.toContain(TRUTH);

      const [counts] = await selectGameCounts(store.db);
      expect(counts).toEqual({ generated: 0, fromCache: 1 });

      const { sessionId } = (await (
        await handleStart(
          context({ cache, model: refuser(), transport: wikipedia([]) }),
          post({ topic: 'chat' }),
        )
      ).json()) as { sessionId: string };
      const [cost] = await selectCostOfGame(store.db, sessionId);
      expect(cost?.calls).toBe(0);
      expect(putCalls).toBe(0);
    });
  });

  describe('when there is no round to be had', () => {
    it('answers 404 when the topic has no article', async () => {
      const response = await handleStart(
        context({ transport: wikipedia([{ query: { search: [] } }]) }),
        post({ topic: 'zzzzzzzz' }),
      );

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ code: 'topic_not_found' });
      expect((await selectGameCounts(store.db))[0]).toEqual({
        generated: 0,
        fromCache: 0,
      });
    });

    // C4.5 — a failed generation is neither cached nor counted as a game, which
    // is not the same as not recorded. It cost a call, and a cost recorded as
    // zero is a cost that looks free.
    it('answers 502 when the model fails, and still bills the call', async () => {
      const response = await handleStart(
        context({ model: refuser() }),
        post({ topic: 'chat' }),
      );

      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({ code: 'generation_failed' });
      expect((await selectGameCounts(store.db))[0]).toEqual({
        generated: 0,
        fromCache: 0,
      });

      expect(await selectFailuresByKind(store.db)).toEqual([
        { kind: 'falsification', failures: 1 },
      ]);
    });

    it('keeps the guest identity it created even when the round fails', async () => {
      const response = await handleStart(
        context({ model: refuser() }),
        post({ topic: 'chat' }),
      );
      expect(cookieFrom(response)).not.toBe('');
    });

    it('answers 400 to a body it cannot read', async () => {
      const notJson = await handleStart(context(), post('{ nope'));
      expect(notJson.status).toBe(400);
      expect(await notJson.json()).toMatchObject({ code: 'bad_json' });

      const emptyTopic = await handleStart(context(), post({ topic: '   ' }));
      expect(emptyTopic.status).toBe(400);

      const absurdLimit = await handleStart(
        context(),
        post({ topic: 'chat', timeLimit: 99_999 }),
      );
      expect(absurdLimit.status).toBe(400);

      expect((await selectGameCounts(store.db))[0]).toEqual({
        generated: 0,
        fromCache: 0,
      });
    });
  });
});

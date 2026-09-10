// A hint paid for in coins — step H.4, against a real Postgres.
//
// The existing hint mechanic is untouched, which is what the track asked for:
// the same rules grant it, the same table records it, and the score penalty is
// still derived from `charged`. Paying in coins charges nothing to the score and
// debits the ledger instead.
//
// **Solo only**, and that is the decision this step turned on. A room round is
// ranked, and a hint paid for in coins leaves the score untouched — so a player
// with coins would outscore one without, on the boards G.5 spent a step keeping
// honest. Refusing in a room is the constraint held by construction.
import {
  game,
  gamePosition,
  participant,
  recordMovement,
  sumBalance,
} from '@wikifake/db';
import { HINT_COINS, HINT_COST, REVEAL_COINS } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from '../auth/auth.js';
import { handleHint } from './hint.js';
import { handleSubmit } from './submit.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

describe.skipIf(url === null)('H.4 — a hint bought with coins', () => {
  let store: TestDatabase;
  let instance: ReturnType<typeof createAuth>;

  beforeAll(async () => {
    store = await openWebTestDatabase();
    instance = createAuth({ db: store.db, secret: SECRET, baseURL: BASE });
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  async function signUp(email: string): Promise<{ cookie: string; userId: string }> {
    const answer = await instance.handler(
      new Request(`${BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Ada', email, password: 'a-password-of-length' }),
      }),
    );
    const body = (await answer.json()) as { user?: { id?: string } };
    const cookie = (answer.headers.getSetCookie() ?? [])
      .map((raw) => raw.split(';')[0])
      .filter((pair): pair is string => pair !== undefined)
      .join('; ');
    return { cookie, userId: body.user?.id as string };
  }

  /** A round in progress with one falsification to ask about. */
  const startRound = async (
    userId: string,
    mode: 'solo' | 'multiplayer',
  ): Promise<string> => {
    const [row] = await store.db
      .insert(game)
      .values({
        mode,
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un paragraphe falsifié', 'un autre'],
        totalFakes: 1,
        timeLimit: 300,
      })
      .returning({ id: game.id });
    const gameId = (row as { id: string }).id;

    await store.db.insert(gamePosition).values({
      gameId,
      paragraphIndex: 1,
      falseInfoNumber: 1,
      falseStatement: 'Le chat dort seize heures.',
      originalText: 'Le chat dort douze heures.',
      explanation: 'Il en dort douze.',
      hint: 'Regardez la durée.',
    });

    await store.db.insert(participant).values({ gameId, userId, colour: '#1f574d' });

    return gameId;
  };

  const context = () => ({ auth: instance, db: store.db });

  const askHint = (
    sessionId: string,
    cookie: string,
    pay: 'score' | 'coins' | undefined,
    level: 1 | 2 = 1,
  ): Promise<Response> =>
    handleHint(
      context(),
      new Request(`${BASE}/api/game/hint`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          sessionId,
          falseInfoNumber: 1,
          level,
          ...(pay === undefined ? {} : { pay }),
        }),
      }),
    );

  /** Coins in the ledger, so a hint can be afforded. */
  const give = async (userId: string, amount: number): Promise<void> => {
    await recordMovement(store.db, {
      userId,
      amount,
      source: 'adjustment',
      idempotencyKey: `seed:${userId}:${String(amount)}`,
    });
  };

  it('debits the coins and charges the score nothing', async () => {
    const ada = await signUp('ada@example.test');
    await give(ada.userId, 50);
    const gameId = await startRound(ada.userId, 'solo');

    const answer = await askHint(gameId, ada.cookie, 'coins');

    expect(answer.status).toBe(200);
    const body = (await answer.json()) as { charged: number; hintPenalty: number };
    expect(body.charged).toBe(0);
    expect(body.hintPenalty).toBe(0);
    expect(await sumBalance(store.db, ada.userId)).toBe(50 - HINT_COINS);
  });

  it('charges the score when nothing says otherwise', async () => {
    // Absent `pay` means score, which is what every request meant before H.4.
    const ada = await signUp('ada@example.test');
    await give(ada.userId, 50);
    const gameId = await startRound(ada.userId, 'solo');

    const answer = await askHint(gameId, ada.cookie, undefined);

    const body = (await answer.json()) as { charged: number };
    expect(body.charged).toBeGreaterThan(0);
    expect(await sumBalance(store.db, ada.userId)).toBe(50);
  });

  it('prices a reveal above a hint', async () => {
    const ada = await signUp('ada@example.test');
    await give(ada.userId, 100);
    const gameId = await startRound(ada.userId, 'solo');

    await askHint(gameId, ada.cookie, 'coins', 2);

    expect(await sumBalance(store.db, ada.userId)).toBe(100 - REVEAL_COINS);
    expect(REVEAL_COINS).toBeGreaterThan(HINT_COINS);
  });

  it('refuses coins in a room, where the score is what a hint costs', async () => {
    /*
     * The decision this step turned on. A room round is ranked; a hint paid for
     * in coins leaves the score untouched; so a player with coins would outscore
     * one without on a board G.5 spent a step keeping honest.
     *
     * And nothing is spent by the refusal — a refusal that took the coins would
     * be the worst of both.
     */
    const ada = await signUp('ada@example.test');
    await give(ada.userId, 50);
    const gameId = await startRound(ada.userId, 'multiplayer');

    const answer = await askHint(gameId, ada.cookie, 'coins');

    expect(answer.status).toBe(409);
    expect(await answer.json()).toMatchObject({ code: 'coins_not_accepted' });
    expect(await sumBalance(store.db, ada.userId)).toBe(50);
  });

  it('still sells a hint for score in a room', async () => {
    // The refusal is about the *currency*, not the hint: a room hint works as
    // it did before this step existed.
    const ada = await signUp('ada@example.test');
    const gameId = await startRound(ada.userId, 'multiplayer');

    const answer = await askHint(gameId, ada.cookie, 'score');

    expect(answer.status).toBe(200);
  });

  it('refuses a player who has not got the coins, and spends nothing', async () => {
    const ada = await signUp('ada@example.test');
    await give(ada.userId, HINT_COINS - 1);
    const gameId = await startRound(ada.userId, 'solo');

    const answer = await askHint(gameId, ada.cookie, 'coins');

    // 402 — the one money-shaped status here, and it is about earned coins.
    expect(answer.status).toBe(402);
    expect(await answer.json()).toMatchObject({ code: 'insufficient_coins' });
    expect(await sumBalance(store.db, ada.userId)).toBe(HINT_COINS - 1);
  });

  it('refuses a player with no coins at all', async () => {
    const ada = await signUp('ada@example.test');
    const gameId = await startRound(ada.userId, 'solo');

    expect((await askHint(gameId, ada.cookie, 'coins')).status).toBe(402);
  });

  it('debits once when the same hint is asked for twice', async () => {
    /*
     * The level is already owned on the second ask — `hint_purchase` refuses to
     * record it twice — and the key on the movement is the level, so the debit
     * cannot happen twice either. Both guards, and the answer is the same both
     * times: the player has the hint and their score is untouched.
     */
    const ada = await signUp('ada@example.test');
    await give(ada.userId, 50);
    const gameId = await startRound(ada.userId, 'solo');

    await askHint(gameId, ada.cookie, 'coins');
    const again = await askHint(gameId, ada.cookie, 'coins');

    expect(again.status).toBe(200);
    expect(await sumBalance(store.db, ada.userId)).toBe(50 - HINT_COINS);
  });

  it('leaves the graded score untouched, which is the point of paying coins', async () => {
    /*
     * The one that matters, and the one that caught the step being wrong.
     *
     * Everything above is about the response to the hint request. What a player
     * cares about is the score that gets written down, and that comes from
     * `handleSubmit` recomputing the penalty from the record. The penalty was
     * derived from *the levels held*, so the first version of this step took the
     * coins and then charged the score anyway — the hint response said zero and
     * the debrief said fifty.
     *
     * Two identical rounds, one hint each, paid for differently. The gap between
     * the two scores is exactly the score price of a hint, and the coin-paid one
     * is the higher.
     */
    const ada = await signUp('ada@example.test');
    await give(ada.userId, 50);

    const play = async (pay: 'score' | 'coins'): Promise<number> => {
      const gameId = await startRound(ada.userId, 'solo');
      await askHint(gameId, ada.cookie, pay);
      const answer = await handleSubmit(
        { ...context(), now: () => new Date(Date.now()) },
        new Request(`${BASE}/api/game/submit`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie: ada.cookie },
          body: JSON.stringify({ sessionId: gameId, marked: [1] }),
        }),
      );
      const body = (await answer.json()) as {
        breakdown: { hintPenalty: number };
        score: number;
      };
      expect(body.breakdown.hintPenalty).toBe(pay === 'coins' ? 0 : HINT_COST);
      return body.score;
    };

    const withCoins = await play('coins');
    const withScore = await play('score');

    expect(withCoins - withScore).toBe(HINT_COST);
  });

  it('does not let a paid hint be re-bought for score', async () => {
    // Owned is owned. A second request in the other currency must not charge
    // either, which the ledger of `hint_purchase` decides rather than the
    // currency.
    const ada = await signUp('ada@example.test');
    await give(ada.userId, 50);
    const gameId = await startRound(ada.userId, 'solo');
    await askHint(gameId, ada.cookie, 'coins');

    const answer = await askHint(gameId, ada.cookie, 'score');

    const body = (await answer.json()) as { charged: number; hintPenalty: number };
    expect(body.charged).toBe(0);
    expect(body.hintPenalty).toBe(0);
  });
});

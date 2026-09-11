// A claimed quest pays — step H.3.
//
// Split from `claim.test.ts` when it crossed the 500-line cap. F.6's refusals
// stay there; what is here is the money: the reward credited in the transaction
// that marks the claim, and nothing credited when the claim is refused.
//
// The session is real rather than mocked, the shape `guests.test.ts`
// established: a mocked session proves the handler reads *something*, not that
// it reads a cookie.
import {
  assignQuests,
  game,
  movementsOf,
  participant,
  selectQuestSet,
  sumBalance,
} from '@wikifake/db';
import { periodIndexOf, QUEST_CATALOGUE } from '@wikifake/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAuth } from '../auth/auth.js';
import { handleClaimQuest } from './claim.js';
import { openWebTestDatabase, webTestDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '@wikifake/db/testing';

const url = webTestDatabaseUrl();
const BASE = 'http://localhost:3000';
const SECRET = 'a-fake-test-signing-secret-32-chars-min';

const DAY = 86_400_000;
/** 2026-09-10, a Thursday. Day 20706. */
const THURSDAY = 20_706 * DAY;
const CLAIMED_AT = new Date(THURSDAY + 12 * 3_600_000);
describe.skipIf(url === null)('H.3 — the claim pays', () => {
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

  const context = () => ({ auth: instance, db: store.db, now: () => CLAIMED_AT });

  const claim = (questId: string, cookie: string): Promise<Response> =>
    handleClaimQuest(
      context(),
      new Request(`${BASE}/api/quests/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ questId }),
      }),
    );

  /** A finished round, so a quest asking for one is complete. */
  const played = async (userId: string, atMs: number): Promise<void> => {
    const [row] = await store.db
      .insert(game)
      .values({
        mode: 'solo',
        topic: 'Chat',
        sourceUrl: 'https://fr.wikipedia.org/wiki/Chat',
        paragraphs: ['un paragraphe'],
        totalFakes: 3,
        timeLimit: 300,
        endedAt: new Date(atMs),
      })
      .returning({ id: game.id });
    await store.db.insert(participant).values({
      gameId: (row as { id: string }).id,
      userId,
      colour: '#1f574d',
      submittedAt: new Date(atMs),
      score: 400,
      truePositives: 3,
      falsePositives: 0,
      hintsUsed: 0,
      hintPenalty: 0,
      scoreStolen: 0,
      timeBonus: 0,
    });
  };

  /** One quest, complete, with the target it needs. */
  const completedQuest = async (userId: string): Promise<string> => {
    const periodIndex = periodIndexOf('daily', THURSDAY);
    await assignQuests(store.db, userId, [
      { ruleId: 'DAILY_FINISH_ROUNDS', period: 'daily', periodIndex, target: 1 },
    ]);
    await played(userId, THURSDAY + 3_600_000);
    const [row] = await selectQuestSet(store.db, userId, 'daily', periodIndex);
    return (row as { id: string }).id;
  };

  it('credits the catalogue’s reward, once', async () => {
    const ada = await signUp('ada@example.test');
    const questId = await completedQuest(ada.userId);

    expect((await claim(questId, ada.cookie)).status).toBe(200);

    const ledger = await movementsOf(store.db, ada.userId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      amount: QUEST_CATALOGUE.DAILY_FINISH_ROUNDS.reward,
      source: 'quest_reward',
      reference: 'DAILY_FINISH_ROUNDS',
    });
    expect(await sumBalance(store.db, ada.userId)).toBe(
      QUEST_CATALOGUE.DAILY_FINISH_ROUNDS.reward,
    );
  });

  it('pays nothing for a second claim', async () => {
    const ada = await signUp('ada@example.test');
    const questId = await completedQuest(ada.userId);
    await claim(questId, ada.cookie);

    expect((await claim(questId, ada.cookie)).status).toBe(409);

    expect(await sumBalance(store.db, ada.userId)).toBe(
      QUEST_CATALOGUE.DAILY_FINISH_ROUNDS.reward,
    );
  });

  it('pays nothing for a claim it refuses', async () => {
    /*
     * The transaction boundary, from the side that matters: a quest that is not
     * finished is refused, and no coin moves. A credit outside the transaction —
     * or before the claim — would pay a player for a quest they had not
     * completed.
     */
    const ada = await signUp('ada@example.test');
    const periodIndex = periodIndexOf('daily', THURSDAY);
    await assignQuests(store.db, ada.userId, [
      { ruleId: 'DAILY_FINISH_ROUNDS', period: 'daily', periodIndex, target: 5 },
    ]);
    await played(ada.userId, THURSDAY + 3_600_000);
    const [row] = await selectQuestSet(store.db, ada.userId, 'daily', periodIndex);

    const answer = await claim((row as { id: string }).id, ada.cookie);

    expect(answer.status).toBe(409);
    expect(await movementsOf(store.db, ada.userId)).toEqual([]);
  });

  it('pays exactly one of two claims arriving at once', async () => {
    // F.6's guarantee, now with money attached: the loser of the claim race
    // must not be paid either, which is why the credit is inside the same
    // transaction as the marking.
    const ada = await signUp('ada@example.test');
    const questId = await completedQuest(ada.userId);

    const answers = await Promise.all([
      claim(questId, ada.cookie),
      claim(questId, ada.cookie),
    ]);

    expect(answers.filter((one) => one.status === 200)).toHaveLength(1);
    expect(await sumBalance(store.db, ada.userId)).toBe(
      QUEST_CATALOGUE.DAILY_FINISH_ROUNDS.reward,
    );
  });
});

// Claiming a reward — step F.6, through the handler and a real database.
//
// `packages/db`'s `quest-claim.test.ts` holds the once-only guarantee where it
// lives, in one conditional update. What this file adds is everything the
// handler decides *before* that statement runs — and the order it decides them
// in, because each refusal has to be reachable:
//
//   - no session, and a quest identifier that is not this account's;
//   - a target that is not met yet, which is the ordinary refusal;
//   - a reward already taken, which is a double-clicked button;
//   - a rule the catalogue has retired, which the screen cannot reach but an
//     old identifier can.
//
// The session is real rather than mocked: `createAuth` over the same test
// database, driven through `auth.handler`, which is the shape `guests.test.ts`
// established for exactly this reason — a mocked session proves the handler
// reads *something*, not that it reads a cookie.
import { assignQuests, game, participant, selectQuestSet } from '@wikifake/db';
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

describe.skipIf(url === null)('F.6 — claiming a reward', () => {
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

  /** An account, and the cookie that proves it. */
  async function signUp(email: string): Promise<{ cookie: string; userId: string }> {
    const answer = await instance.handler(
      new Request(`${BASE}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Ada', email, password: 'a-password-of-length' }),
      }),
    );
    const body = (await answer.json()) as { user?: { id?: string } };
    const userId = body.user?.id;
    if (userId === undefined) throw new Error('no account');

    const cookie = (answer.headers.getSetCookie() ?? [])
      .map((raw) => raw.split(';')[0])
      .filter((pair): pair is string => pair !== undefined)
      .join('; ');

    return { cookie, userId };
  }

  const context = () => ({
    auth: instance,
    db: store.db,
    now: () => CLAIMED_AT,
  });

  const claim = (questId: string, cookie?: string): Promise<Response> =>
    handleClaimQuest(
      context(),
      new Request(`${BASE}/api/quests/claim`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(cookie === undefined ? {} : { cookie }),
        },
        body: JSON.stringify({ questId }),
      }),
    );

  /** A finished round for this account, inside Thursday. */
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
    if (row === undefined) throw new Error('no game');

    await store.db.insert(participant).values({
      gameId: row.id,
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

  /**
   * One quest for this account, with a target the caller chooses.
   *
   * `atMs` decides which day the quest belongs to, and it defaults to the
   * Thursday everything else uses. It is a parameter because the handler must
   * measure a quest against *its own* period rather than against today, and a
   * suite where every quest is today's cannot tell those apart — which is
   * exactly what a mutation proved about the first draft of this file.
   */
  const giveQuest = async (
    userId: string,
    target: number,
    atMs: number = THURSDAY,
  ): Promise<string> => {
    const periodIndex = periodIndexOf('daily', atMs);
    await assignQuests(store.db, userId, [
      { ruleId: 'DAILY_FINISH_ROUNDS', period: 'daily', periodIndex, target },
    ]);
    const [row] = await selectQuestSet(store.db, userId, 'daily', periodIndex);
    if (row === undefined) throw new Error('no quest');
    return row.id;
  };

  it('pays a quest whose target has been met', async () => {
    const ada = await signUp('ada@example.test');
    const questId = await giveQuest(ada.userId, 2);
    await played(ada.userId, THURSDAY + 3_600_000);
    await played(ada.userId, THURSDAY + 7_200_000);

    const answer = await claim(questId, ada.cookie);

    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({
      questId,
      ruleId: 'DAILY_FINISH_ROUNDS',
      // From the catalogue, not from the row: the figure a player is told they
      // earned is the one the server decided.
      reward: QUEST_CATALOGUE.DAILY_FINISH_ROUNDS.reward,
      claimedAt: CLAIMED_AT.toISOString(),
    });
  });

  it('writes the claim down, so a second request is a refusal', async () => {
    const ada = await signUp('ada@example.test');
    const questId = await giveQuest(ada.userId, 1);
    await played(ada.userId, THURSDAY + 3_600_000);

    expect((await claim(questId, ada.cookie)).status).toBe(200);

    const again = await claim(questId, ada.cookie);
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: 'quest_already_claimed' });
  });

  it('refuses a target that is not met yet, and says which refusal it is', async () => {
    // The ordinary case, and it has its own code because a player can act on
    // it: this one becomes claimable by playing.
    const ada = await signUp('ada@example.test');
    const questId = await giveQuest(ada.userId, 3);
    await played(ada.userId, THURSDAY + 3_600_000);

    const answer = await claim(questId, ada.cookie);

    expect(answer.status).toBe(409);
    expect(await answer.json()).toMatchObject({ code: 'quest_not_complete' });
  });

  it('counts only the rounds inside the quest’s own period', async () => {
    // Two rounds, one of them yesterday. A handler that ignored the window
    // would pay this out, which is the whole reason `periodWindowOf` is asked
    // for the quest's `periodIndex` rather than for today's.
    const ada = await signUp('ada@example.test');
    const questId = await giveQuest(ada.userId, 2);
    await played(ada.userId, THURSDAY + 3_600_000);
    await played(ada.userId, THURSDAY - 3_600_000);

    const answer = await claim(questId, ada.cookie);

    expect(answer.status).toBe(409);
    expect(await answer.json()).toMatchObject({ code: 'quest_not_complete' });
  });

  it('measures a quest against its own day, not against today', async () => {
    /*
     * Yesterday's quest, finished yesterday, claimed today.
     *
     * The handler asks `periodWindowOf` for the quest's `periodIndex`, so those
     * rounds still count. Asking for *today's* index instead would refuse this
     * as incomplete — and a mutation doing exactly that passed the first draft
     * of this file, because every quest in it belonged to today.
     *
     * Whether a finished quest should stay claimable after its day is over is
     * not decided here; what is decided is that the measurement follows the
     * quest. F.7 can hide an expired one without this changing.
     */
    const ada = await signUp('ada@example.test');
    const questId = await giveQuest(ada.userId, 2, THURSDAY - DAY);
    await played(ada.userId, THURSDAY - DAY + 3_600_000);
    await played(ada.userId, THURSDAY - DAY + 7_200_000);

    const answer = await claim(questId, ada.cookie);

    expect(answer.status).toBe(200);
    expect(await answer.json()).toMatchObject({ ruleId: 'DAILY_FINISH_ROUNDS' });
  });

  it('does not let today’s rounds finish yesterday’s quest', async () => {
    // The same rule from the other side, and the pair is what pins the window:
    // one case fails if the window is today's, the other if it is unbounded.
    const ada = await signUp('ada@example.test');
    const questId = await giveQuest(ada.userId, 2, THURSDAY - DAY);
    await played(ada.userId, THURSDAY + 3_600_000);
    await played(ada.userId, THURSDAY + 7_200_000);

    const answer = await claim(questId, ada.cookie);

    expect(answer.status).toBe(409);
    expect(await answer.json()).toMatchObject({ code: 'quest_not_complete' });
  });

  it('refuses somebody else’s quest as absent', async () => {
    const ada = await signUp('ada@example.test');
    const bob = await signUp('bob@example.test');
    const questId = await giveQuest(ada.userId, 1);
    await played(ada.userId, THURSDAY + 3_600_000);

    const answer = await claim(questId, bob.cookie);

    expect(answer.status).toBe(404);
    expect(await answer.json()).toMatchObject({ code: 'quest_not_found' });

    // And Ada's quest is untouched, which is the half a status code cannot say.
    const [row] = await selectQuestSet(
      store.db,
      ada.userId,
      'daily',
      periodIndexOf('daily', THURSDAY),
    );
    expect(row?.claimedAt).toBeNull();
  });

  it('refuses a request with no session at all', async () => {
    const ada = await signUp('ada@example.test');
    const questId = await giveQuest(ada.userId, 1);

    const answer = await claim(questId);

    expect(answer.status).toBe(404);
    expect(await answer.json()).toMatchObject({ code: 'quest_not_found' });
  });

  it('refuses a quest identifier nobody holds', async () => {
    const ada = await signUp('ada@example.test');

    const answer = await claim('00000000-0000-4000-8000-000000000000', ada.cookie);

    expect(answer.status).toBe(404);
  });

  it('refuses a body that is not an identifier', async () => {
    // `bad_json` and not a quest code: a malformed body is not a claim about
    // any quest, so it cannot be that quest's problem. And the `uuid` check is
    // what stops a well-formed string reaching Postgres as a syntax error —
    // which would arrive as a 500 rather than as the refusal it is.
    const ada = await signUp('ada@example.test');

    const answer = await handleClaimQuest(
      context(),
      new Request(`${BASE}/api/quests/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: ada.cookie },
        body: JSON.stringify({ questId: 'not-a-uuid' }),
      }),
    );

    expect(answer.status).toBe(400);
    expect(await answer.json()).toMatchObject({ code: 'bad_json' });
  });

  it('pays nothing for a rule the catalogue has retired', async () => {
    // Unreachable through the screen — `sets.ts` drops such a row from the list
    // — but an identifier kept from an earlier session reaches it, and there is
    // no reward to pay for a rule that no longer exists.
    const ada = await signUp('ada@example.test');
    const periodIndex = periodIndexOf('daily', THURSDAY);
    await assignQuests(store.db, ada.userId, [
      { ruleId: 'DAILY_RULE_THAT_WAS_RETIRED', period: 'daily', periodIndex, target: 1 },
    ]);
    const [row] = await selectQuestSet(store.db, ada.userId, 'daily', periodIndex);
    await played(ada.userId, THURSDAY + 3_600_000);

    const answer = await claim(row?.id as string, ada.cookie);

    expect(answer.status).toBe(404);
    expect(await answer.json()).toMatchObject({ code: 'quest_not_found' });
  });

  it('pays once when the same claim arrives twice at once', async () => {
    /*
     * The handler's own view of the exit gate — "claiming twice, concurrently,
     * credits once".
     *
     * Both requests read, both judge the quest complete, and both reach the
     * update: this is the race the ordering in `claim.ts` deliberately allows,
     * because the atomic step is the last one. `quest-claim.test.ts` proves the
     * statement; this proves the handler does not add a way around it.
     *
     * Note that these share one connection, so they may well serialise —
     * `08-toolchain-debt.md` records why that is not a race. The value here is
     * that the *outcome* is right either way: exactly one 200.
     */
    const ada = await signUp('ada@example.test');
    const questId = await giveQuest(ada.userId, 1);
    await played(ada.userId, THURSDAY + 3_600_000);

    const answers = await Promise.all([
      claim(questId, ada.cookie),
      claim(questId, ada.cookie),
    ]);

    expect(answers.filter((one) => one.status === 200)).toHaveLength(1);
    expect(answers.filter((one) => one.status === 409)).toHaveLength(1);
  });
});

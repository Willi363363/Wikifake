// Quest assignments, against a real Postgres — step F.3.
//
// The property the whole of track F rests on is **writing a set twice writes
// one set**, and it is a property of a unique index rather than of the code
// above it. So it is asserted the only way that means anything: two calls, and
// then two calls that have not committed when the other is issued — which no
// read-then-insert could refuse and which a mock could not tell apart from
// success.
//
// `db` may not import `@wikifake/domain` — `workspace-graph.test.ts` says data
// does not depend on rules — so the fixtures below spell out rule identifiers as
// strings. That is not a shortcut: it is the same distance the production caller
// keeps, and a test importing the catalogue would be testing a coupling the
// package does not have.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { assignQuests, selectQuestSet, type QuestToAssign } from './quests.js';
import { user } from '../schema/auth.js';
import { questAssignment } from '../schema/quests.js';
import { openTestDatabase, rejectionCode, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

/** Day 20706 is 2026-09-10. The number only has to be stable, not readable. */
const TODAY = 20_706;

const DAILY: readonly QuestToAssign[] = [
  { ruleId: 'DAILY_FINISH_ROUNDS', period: 'daily', periodIndex: TODAY, target: 3 },
  { ruleId: 'DAILY_SCORE_POINTS', period: 'daily', periodIndex: TODAY, target: 700 },
  { ruleId: 'DAILY_UNAIDED_ROUND', period: 'daily', periodIndex: TODAY, target: 1 },
];

describe.skipIf(url === null)('F.3 — a quest set, written down', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
  });

  beforeEach(async () => {
    await store.truncate();
  });

  afterAll(async () => {
    await store.close();
  });

  /** An account to hang quests off. Better Auth would create these. */
  const addUser = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
  };

  const rowCount = async (): Promise<number> =>
    (await store.db.select({ id: questAssignment.id }).from(questAssignment)).length;

  it('writes the set it was given', async () => {
    await addUser('ada');

    expect(await assignQuests(store.db, 'ada', DAILY)).toBe(3);

    const set = await selectQuestSet(store.db, 'ada', 'daily', TODAY);
    expect(set.map((quest) => quest.ruleId)).toEqual([
      'DAILY_FINISH_ROUNDS',
      'DAILY_SCORE_POINTS',
      'DAILY_UNAIDED_ROUND',
    ]);
    expect(set.map((quest) => quest.target)).toEqual([3, 700, 1]);
    // A live quest, which is what null means here.
    expect(set.every((quest) => quest.claimedAt === null)).toBe(true);
  });

  it('writes nothing the second time, and says so', async () => {
    // F.5's exit gate: "the cron is run twice for the same date and nothing is
    // duplicated." The count coming back as 0 is what a cron logs.
    await addUser('ada');
    await assignQuests(store.db, 'ada', DAILY);

    expect(await assignQuests(store.db, 'ada', DAILY)).toBe(0);
    expect(await rowCount()).toBe(3);
  });

  it('refuses a duplicate at the constraint, not in the code', async () => {
    // The `onConflictDoNothing` above is a convenience over this. If the index
    // were ever dropped, the assertion above would keep passing on a second
    // insert that silently duplicated; this one would not.
    await addUser('ada');
    await assignQuests(store.db, 'ada', DAILY);

    const code = await rejectionCode(
      store.db.insert(questAssignment).values({
        userId: 'ada',
        period: 'daily',
        periodIndex: TODAY,
        ruleId: 'DAILY_FINISH_ROUNDS',
        target: 3,
      }),
    );

    expect(code).toBe('23505');
  });

  it('keeps the promise it already made when a target changes', async () => {
    /*
     * The reason the target is a column at all.
     *
     * A catalogue edit that widens a rule's range would make the generator draw
     * a different number for the same day. `assignQuests` does not update on
     * conflict, so a player who has half finished a quest keeps the target they
     * were given — and tomorrow's set gets the new range.
     */
    await addUser('ada');
    await assignQuests(store.db, 'ada', DAILY);

    const rewritten = DAILY.map((quest) => ({ ...quest, target: quest.target + 5 }));
    expect(await assignQuests(store.db, 'ada', rewritten)).toBe(0);

    const set = await selectQuestSet(store.db, 'ada', 'daily', TODAY);
    expect(set.map((quest) => quest.target)).toEqual([3, 700, 1]);
  });

  it('survives two callers racing for the same set', async () => {
    /*
     * The cron and the read path, at the same instant.
     *
     * F.5's read path is self-healing — a player whose set was never generated
     * gets it on their next request — so the cron writing while somebody loads
     * the screen is the ordinary case rather than the unlucky one. Both
     * transactions are opened before either commits, which is precisely what a
     * `select` first could not survive.
     */
    await addUser('ada');

    const [first, second] = await Promise.all([
      store.db.transaction((tx) => assignQuests(tx, 'ada', DAILY)),
      store.db.transaction((tx) => assignQuests(tx, 'ada', DAILY)),
    ]);

    // One of them wrote the set and the other wrote nothing. Which is not
    // decided here, and does not matter — what matters is that it is one set.
    expect([first, second].sort((a, b) => a - b)).toEqual([0, 3]);
    expect(await rowCount()).toBe(3);
  });

  it('keeps a set apart from another period, another day and another player', async () => {
    await addUser('ada');
    await addUser('bob');

    await assignQuests(store.db, 'ada', DAILY);
    // The same rule identifier, the same index, a different period. The unique
    // key holds all four columns, so this is a row and not a conflict — and a
    // weekly index of 20706 is a different thing from a daily one entirely.
    await assignQuests(store.db, 'ada', [
      { ruleId: 'DAILY_FINISH_ROUNDS', period: 'weekly', periodIndex: TODAY, target: 12 },
    ]);
    await assignQuests(store.db, 'ada', [
      {
        ruleId: 'DAILY_FINISH_ROUNDS',
        period: 'daily',
        periodIndex: TODAY + 1,
        target: 4,
      },
    ]);
    await assignQuests(store.db, 'bob', DAILY);

    expect(await selectQuestSet(store.db, 'ada', 'daily', TODAY)).toHaveLength(3);
    expect(await selectQuestSet(store.db, 'ada', 'weekly', TODAY)).toHaveLength(1);
    expect(await selectQuestSet(store.db, 'ada', 'daily', TODAY + 1)).toHaveLength(1);
    expect(await selectQuestSet(store.db, 'bob', 'daily', TODAY)).toHaveLength(3);
    expect(await rowCount()).toBe(8);
  });

  it('has nothing to say about a day nobody was assigned', async () => {
    await addUser('ada');
    await assignQuests(store.db, 'ada', DAILY);

    // Not an error and not an empty set standing in for one: F.4's read path
    // decides what to do about a day with no rows, and generating one is
    // exactly what it will do.
    expect(await selectQuestSet(store.db, 'ada', 'daily', TODAY - 1)).toEqual([]);
    expect(await selectQuestSet(store.db, 'nobody', 'daily', TODAY)).toEqual([]);
  });

  it('writes nothing at all for an empty set', async () => {
    await addUser('ada');

    // The guard exists because an insert with no values is a syntax error rather
    // than a no-op, and a period whose rules were all retired would produce one.
    expect(await assignQuests(store.db, 'ada', [])).toBe(0);
    expect(await rowCount()).toBe(0);
  });

  it('refuses a target that is already met', async () => {
    await addUser('ada');

    const code = await rejectionCode(
      store.db.insert(questAssignment).values({
        userId: 'ada',
        period: 'daily',
        periodIndex: TODAY,
        ruleId: 'DAILY_FINISH_ROUNDS',
        target: 0,
      }),
    );

    // 23514 — a check violation. A target of zero is a quest complete before it
    // is assigned, and the catalogue's own test refuses it a range away from
    // here; this is the half that survives a caller doing its own arithmetic.
    expect(code).toBe('23514');
  });

  it('takes a player’s quests with them when the account goes', async () => {
    // E.7 deletes an account and expects finished rooms to stay coherent. A
    // quest is not a finished room: it is a promise to somebody who no longer
    // exists, so it cascades rather than being orphaned.
    await addUser('ada');
    await assignQuests(store.db, 'ada', DAILY);

    await store.db.delete(user).where(eq(user.id, 'ada'));

    expect(await rowCount()).toBe(0);
  });
});

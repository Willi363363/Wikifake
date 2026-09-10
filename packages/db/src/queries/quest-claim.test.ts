// Claiming a quest, exactly once — step F.6, against a real Postgres.
//
// Split from `quests.test.ts` when it crossed the 500-line cap. F.3's
// assignment and F.4's window stay there; what is here is the once-only
// marking, which is the one property in track F where getting it wrong hands a
// player unlimited coins.
//
// **The most important case in this file is not a race.** A mutation turned
// `claimQuest` into a check followed by an unconditional write — the version a
// retry pays twice — and it passed every behavioural case, including the ones
// with "concurrently" in their names. `openTestDatabase` opens the pool with
// `max: 1`, so two transactions on the shared handle are serialised and never
// contend. So the races below open their own connections, and the predicate is
// read off the statement: `game.test.ts` made the same move for C1.1, where
// omitting a column is something a reviewer has to notice and not joining a
// table is something a test can read.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  assignQuests,
  claimQuest,
  claimStatement,
  selectQuestById,
  selectQuestSet,
  type QuestToAssign,
} from './quests.js';
import { connect } from '../client.js';
import { user } from '../schema/auth.js';
import { openTestDatabase, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

/** Day 20706 is 2026-09-10. The number only has to be stable, not readable. */
const TODAY = 20_706;

const DAILY: readonly QuestToAssign[] = [
  { ruleId: 'DAILY_FINISH_ROUNDS', period: 'daily', periodIndex: TODAY, target: 3 },
  { ruleId: 'DAILY_SCORE_POINTS', period: 'daily', periodIndex: TODAY, target: 700 },
  { ruleId: 'DAILY_UNAIDED_ROUND', period: 'daily', periodIndex: TODAY, target: 1 },
];

describe.skipIf(url === null)('F.6 — claiming, exactly once', () => {
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

  const addUser = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
  };

  /** One quest, and the id a claim is made against. */
  const oneQuest = async (userId: string): Promise<string> => {
    await assignQuests(store.db, userId, [DAILY[0] as QuestToAssign]);
    const [row] = await selectQuestSet(store.db, userId, 'daily', TODAY);
    if (row === undefined) throw new Error('no quest');
    return row.id;
  };

  const AT = new Date('2026-09-10T12:00:00.000Z');

  it('marks the quest claimed, and hands back what was claimed', async () => {
    await addUser('ada');
    const questId = await oneQuest('ada');

    const claim = await claimQuest(store.db, 'ada', questId, AT);

    expect(claim.ok).toBe(true);
    if (!claim.ok) return;
    expect(claim.quest.ruleId).toBe('DAILY_FINISH_ROUNDS');
    expect(claim.quest.target).toBe(3);
    expect(claim.quest.claimedAt?.getTime()).toBe(AT.getTime());
  });

  it('refuses the second claim, and says which failure it was', async () => {
    await addUser('ada');
    const questId = await oneQuest('ada');
    await claimQuest(store.db, 'ada', questId, AT);

    expect(await claimQuest(store.db, 'ada', questId, AT)).toEqual({
      ok: false,
      reason: 'already_claimed',
    });
  });

  it('leaves the first claim’s instant alone', async () => {
    // The `is null` predicate is what does this: a second claim matches no row,
    // so it cannot move the timestamp. An unconditional update would.
    await addUser('ada');
    const questId = await oneQuest('ada');
    await claimQuest(store.db, 'ada', questId, AT);

    const later = new Date(AT.getTime() + 3_600_000);
    await claimQuest(store.db, 'ada', questId, later);

    const [row] = await selectQuestSet(store.db, 'ada', 'daily', TODAY);
    expect(row?.claimedAt?.getTime()).toBe(AT.getTime());
  });

  it('pays nobody else’s quest', async () => {
    // Scoped by `user_id` as well as by `id`, so a guessed identifier is not a
    // claim. `not_found` and not `already_claimed`: the answer must not say
    // whether somebody else's quest exists.
    await addUser('ada');
    await addUser('bob');
    const questId = await oneQuest('ada');

    expect(await claimQuest(store.db, 'bob', questId, AT)).toEqual({
      ok: false,
      reason: 'not_found',
    });

    const [row] = await selectQuestSet(store.db, 'ada', 'daily', TODAY);
    expect(row?.claimedAt).toBeNull();
  });

  it('refuses a quest that does not exist', async () => {
    await addUser('ada');

    expect(
      await claimQuest(store.db, 'ada', '00000000-0000-4000-8000-000000000000', AT),
    ).toEqual({ ok: false, reason: 'not_found' });
  });

  /*
   * The guarantee, read off the statement rather than raced for.
   *
   * This assertion exists because the behavioural ones below **cannot** catch
   * the defect it is about. Mutating `claimQuest` into a check-then-write —
   * select `claimed_at`, return early if set, otherwise update unconditionally —
   * passes every other case in this file, including the two that say
   * "concurrently". The reason is `openTestDatabase`, which opens the pool with
   * `max: 1`: two transactions on one connection are serialised by the pool, so
   * nothing ever raced.
   *
   * `game.test.ts` reached the same conclusion for C1.1 and put it best —
   * omitting a column is something a reviewer has to notice, not joining a table
   * is something a test can read. The predicate is the guarantee, so the test
   * reads the predicate.
   */
  it('sends the predicate the guarantee lives in', async () => {
    await addUser('ada');
    const questId = await oneQuest('ada');

    const { sql } = claimStatement(store.db, 'ada', questId, AT).toSQL();

    // An unconditional update, or one guarded only on the identifier, is the
    // version a retry can pay twice.
    expect(sql).toContain('is null');
    expect(sql).toMatch(/"claimed_at"\s+is null/);
    expect(sql).toContain('"user_id"');
  });

  it('credits one of two claims that genuinely race, and only one', async () => {
    /*
     * The exit gate: "claiming twice, concurrently, credits once."
     *
     * **On two connections**, which is the whole difference from the first draft
     * of this test. `openTestDatabase` uses `max: 1` — deliberately, so a leaked
     * transaction hangs the test that leaked it — and two transactions over one
     * connection do not overlap at all. So this opens a second connection and
     * lets the two contend for the row.
     *
     * A double-clicked button and a retried request both have this shape.
     */
    await addUser('ada');
    const questId = await oneQuest('ada');

    const other = connect({ url: url as string, max: 1 });
    try {
      const [first, second] = await Promise.all([
        store.db.transaction((tx) => claimQuest(tx, 'ada', questId, AT)),
        other.db.transaction((tx) => claimQuest(tx, 'ada', questId, AT)),
      ]);

      expect([first.ok, second.ok].sort()).toEqual([false, true]);

      // And the loser was told why, rather than handed a silent failure.
      const loser = first.ok ? second : first;
      expect(loser).toEqual({ ok: false, reason: 'already_claimed' });
    } finally {
      await other.close();
    }
  });

  it('survives ten claims at once, over four connections', async () => {
    // The same property with the odds against it: one winner, nine losers, and
    // one `claimed_at` at the end of it.
    await addUser('ada');
    const questId = await oneQuest('ada');

    const pools = Array.from({ length: 4 }, () =>
      connect({ url: url as string, max: 1 }),
    );
    try {
      const claims = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
          (pools[index % pools.length] as (typeof pools)[number]).db.transaction((tx) =>
            claimQuest(tx, 'ada', questId, AT),
          ),
        ),
      );

      expect(claims.filter((claim) => claim.ok)).toHaveLength(1);
      expect(claims.filter((claim) => !claim.ok)).toHaveLength(9);

      const [row] = await selectQuestSet(store.db, 'ada', 'daily', TODAY);
      expect(row?.claimedAt?.getTime()).toBe(AT.getTime());
    } finally {
      await Promise.all(pools.map((pool) => pool.close()));
    }
  });
});

describe.skipIf(url === null)('F.6 — one quest, by its identifier', () => {
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

  const addUser = async (id: string): Promise<void> => {
    await store.db
      .insert(user)
      .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
  };

  it('reads the quest, with everything a claim has to decide on', async () => {
    await addUser('ada');
    await assignQuests(store.db, 'ada', DAILY);
    const [first] = await selectQuestSet(store.db, 'ada', 'daily', TODAY);

    const quest = await selectQuestById(store.db, 'ada', first?.id as string);

    expect(quest).toMatchObject({
      ruleId: 'DAILY_FINISH_ROUNDS',
      period: 'daily',
      periodIndex: TODAY,
      target: 3,
      claimedAt: null,
    });
  });

  it('reads somebody else’s quest as absent, not as theirs', async () => {
    await addUser('ada');
    await addUser('bob');
    await assignQuests(store.db, 'ada', DAILY);
    const [first] = await selectQuestSet(store.db, 'ada', 'daily', TODAY);

    expect(await selectQuestById(store.db, 'bob', first?.id as string)).toBeNull();
  });

  it('reads an identifier nobody holds as absent', async () => {
    await addUser('ada');

    expect(
      await selectQuestById(store.db, 'ada', '00000000-0000-4000-8000-000000000000'),
    ).toBeNull();
  });
});

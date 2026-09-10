// The balance read, on a ledger that has grown — step H.2.
//
// The track's exit gate: *"a balance read matches the sum of movements, on a
// seeded account with thousands of them."* That is two claims rather than one —
// **the fast read agrees with the slow one**, and **the fast read stays fast** —
// and this file makes both of them measurable.
//
// The plan is read rather than the clock, for G.4's reason: a millisecond budget
// on a shared runner is a flake with a number attached, and `explain` is
// deterministic given the same rows and statistics. The timings are printed so a
// change that makes a balance ten times slower is visible to whoever runs the
// suite.
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { balanceQuery, selectBalance, sumBalance } from './coins.js';
import { user } from '../schema/auth.js';
import { openTestDatabase, testDatabaseUrl } from '../testing/database.js';
import type { TestDatabase } from '../testing/database.js';

const url = testDatabaseUrl();

/**
 * Movements for one player, and a second player to prove the index narrows.
 *
 * Five thousand is "thousands" as the gate asks, and far past where summing is
 * free: it is the point at which the difference between one row and every row
 * stops being theoretical.
 */
const MOVEMENTS = 5_000;

describe.skipIf(url === null)('H.2 — the balance of a long ledger', () => {
  let store: TestDatabase;

  beforeAll(async () => {
    store = await openTestDatabase(url as string);
    await store.truncate();

    for (const id of ['ada', 'bob']) {
      await store.db
        .insert(user)
        .values({ id, name: id, email: `${id}@example.test`, emailVerified: false });
    }

    /*
     * Written with `generate_series` and a running total, because five thousand
     * round trips is a minute of test time — and this file is inside
     * `@wikifake/db`, the one package allowed free-form SQL.
     *
     * The amounts alternate sign so the balance is not a straight line: a sum
     * that agreed with a monotonic ledger might be adding absolute values.
     */
    await store.db.execute(sql`
      insert into coin_movement
        (user_id, amount, source, reference, idempotency_key, balance_after)
      select 'ada',
             amount,
             'round_end'::coin_source,
             'seed',
             'seed:' || i,
             sum(amount) over (order by i)
      from (
        select i, (case when i % 3 = 0 then -5 else 12 end) as amount
        from generate_series(1, ${MOVEMENTS}) as s(i)
      ) as movements
    `);

    // A second player, so "this player's balance" has something to be narrowed
    // from — an index that ignored `user_id` would still pass on one account.
    await store.db.execute(sql`
      insert into coin_movement
        (user_id, amount, source, reference, idempotency_key, balance_after)
      select 'bob', 7, 'round_end'::coin_source, 'seed', 'seed:' || i, 7 * i
      from generate_series(1, 100) as s(i)
    `);

    await store.db.execute(sql`analyze coin_movement`);
  }, 240_000);

  afterAll(async () => {
    await store.truncate();
    await store.close();
  });

  /** The plan the balance read sends, as one string. */
  const planFor = async (): Promise<string> => {
    const { sql: text, params } = balanceQuery(store.db, 'ada').toSQL();
    // Substituted **by index**, which the first version of this got wrong: a
    // replacement that ignored the number turned `limit $2` into `limit 'ada'`
    // and the explain failed as a syntax error rather than as an assertion.
    const inlined = text.replace(/\$(\d+)/g, (_, index: string) => {
      const value = params[Number(index) - 1];
      return typeof value === 'number' ? String(value) : `'${String(value)}'`;
    });
    const rows = await store.db.execute(sql.raw(`explain (analyze) ${inlined}`));
    return [...rows].map((row) => Object.values(row)[0] as string).join('\n');
  };

  it('seeded the ledger it claims to have', async () => {
    // A plan measured on an empty table would pass and prove nothing.
    const rows = await store.db.execute(
      sql`select count(*)::int as n from coin_movement where user_id = 'ada'`,
    );
    expect([...rows][0]).toEqual({ n: MOVEMENTS });
  });

  it('reads the same balance both ways', async () => {
    /*
     * The exit gate's own sentence. `selectBalance` takes one row and
     * `sumBalance` adds up five thousand, and they must agree — which is what
     * makes the fast read trustworthy rather than merely fast.
     *
     * If they ever disagree, the fast one is wrong: the sum is the definition.
     */
    const fast = await selectBalance(store.db, 'ada');
    const audited = await sumBalance(store.db, 'ada');

    expect(fast).toBe(audited);
    // And it is a real number rather than zero on both sides, which a broken
    // seed would also satisfy.
    expect(audited).toBeGreaterThan(0);
  });

  it('can be served by the index it has, in order', async () => {
    /*
     * The schema's claim, with the cost model taken out of it — G.4's shape,
     * arrived at here for the same reason.
     *
     * At five thousand narrow rows Postgres chooses a **sequential scan** and a
     * top-N sort, in 0.8 ms, and it is right to: the table is a few hundred
     * kilobytes. Demanding an index scan at this size would be asserting against
     * the planner.
     *
     * So the question asked is the one the schema is responsible for: *can* an
     * index answer this read in order, so that it stays one seek as the ledger
     * grows. `enable_seqscan` and `enable_bitmapscan` off remove the
     * alternatives — a bitmap returns heap order and would bring the sort back,
     * which H.1's suite learned the same way F.6's did.
     *
     * Dropping `coin_movement_balance_idx` turns this red. Ordering the read by
     * `created_at` instead of `seq` does too, because that index cannot serve
     * it.
     */
    await store.db.execute(sql`set enable_seqscan = off`);
    await store.db.execute(sql`set enable_bitmapscan = off`);
    try {
      const plan = await planFor();

      expect(plan, plan).toMatch(/Index Scan.*coin_movement_balance_idx/);
      expect(plan, plan).not.toMatch(/Sort/);
    } finally {
      await store.db.execute(sql`set enable_seqscan = on`);
      await store.db.execute(sql`set enable_bitmapscan = on`);
    }
  });

  it('is what the planner chooses on its own, with no flags', async () => {
    /*
     * **This case said the opposite until the ordering was fixed, and the story
     * is worth keeping.**
     *
     * The first version asserted a `Seq Scan` and recorded that
     * `balance_after` "buys nothing yet" — because summing five thousand rows
     * measured *faster* than reading one. That was true, and the reason was not
     * the size of the table: `order by seq desc` is `desc nulls first` in SQL,
     * the index is `desc nulls last`, and Postgres therefore could not use it
     * for the ordering at all. It read every movement and sorted them.
     *
     *     order by seq desc              cost 139   0.77 ms   Seq Scan + sort
     *     order by seq desc nulls last   cost 0.35  0.08 ms   Index Scan
     *
     * So the column does buy something, and the planner reaches for it without
     * being forced. The lesson is the one G.4 half-learned: a measurement that
     * says an index is not worth using is sometimes a measurement of an index
     * that *cannot* be used.
     */
    const plan = await planFor();

    expect(plan, plan).toMatch(/Index Scan.*coin_movement_balance_idx/);
    expect(plan, plan).not.toMatch(/Seq Scan on coin_movement/);
    expect(plan, plan).not.toMatch(/Sort/);
  });

  it('narrows to the player asked about', async () => {
    // Two accounts in the table, so a read that ignored `user_id` would return
    // the wrong balance rather than merely a slow one.
    expect(await selectBalance(store.db, 'bob')).toBe(700);
    expect(await sumBalance(store.db, 'bob')).toBe(700);
    expect(await selectBalance(store.db, 'ada')).not.toBe(700);
  });

  it('answers at the seeded size', async () => {
    const started = performance.now();
    await selectBalance(store.db, 'ada');
    const fast = performance.now() - started;

    const summing = performance.now();
    await sumBalance(store.db, 'ada');
    const slow = performance.now() - summing;

    // Printed rather than asserted on: what each costs on one machine is not a
    // contract, and at five thousand rows the two are close. What matters is
    // that they scale differently — one row is constant, the sum is linear —
    // and the plan case above is what holds the constant one to its index.
    // eslint-disable-next-line no-console
    console.info(
      `H.2 — balance of ${String(MOVEMENTS)} movements: one row ${fast.toFixed(2)} ms, summed ${slow.toFixed(2)} ms`,
    );
    expect(fast).toBeGreaterThan(0);
  });
});

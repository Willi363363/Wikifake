// Moving coins, once — step H.1.
//
// One function that writes, and it has two jobs a caller must not be able to get
// wrong: **the same key credits once**, and **`balance_after` agrees with the
// sum of the rows**. Both are properties of the write, so both are enforced here
// rather than trusted to whoever calls it.
import { and, desc, eq, sql } from 'drizzle-orm';

import type { Database } from '../client.js';
import { coinMovement } from '../schema/coins.js';
import { user } from '../schema/auth.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** The five sources the ledger knows. */
export type CoinSource =
  'quest_reward' | 'round_end' | 'hint_purchase' | 'cosmetic_purchase' | 'adjustment';

/** A movement to record. `amount` is signed: negative spends. */
export interface CoinMovementToRecord {
  readonly userId: string;
  readonly amount: number;
  readonly source: CoinSource;
  readonly reference?: string | null;
  /** Unique per player. The same key twice is one movement. */
  readonly idempotencyKey: string;
}

export interface RecordedMovement {
  readonly id: string;
  readonly amount: number;
  readonly source: CoinSource;
  readonly reference: string | null;
  readonly balanceAfter: number;
  readonly createdAt: Date;
}

/** What a call came to. `fresh` is false when the key had already been used. */
export interface MovementOutcome {
  readonly movement: RecordedMovement;
  readonly fresh: boolean;
}

/**
 * Records a movement, exactly once per key.
 *
 * **It takes a lock on the player first**, and that is the whole design. Two
 * credits arriving together would otherwise both read the same balance and both
 * write the same `balance_after`, leaving a ledger whose last row disagrees with
 * the sum of its rows — and nothing would notice, because both rows look
 * complete on their own.
 *
 * `select 1 from "user" where id = $1 for update` is the lock, and the
 * granularity is exactly right: it serialises one player's movements and no
 * other player's. A table-level lock would serialise the whole game; an
 * advisory lock would be a second thing to remember.
 *
 * **Idempotency is the unique index, not a check.** A caller retrying sees the
 * movement that already exists rather than an error, because a retry is not a
 * failure — it is the same request arriving twice, and the honest answer is what
 * happened the first time. `fresh` says which it was, so F.6's claim can tell a
 * first payment from a replay without asking again.
 *
 * **`on conflict do nothing` and not a caught violation**, which cost this
 * function a rewrite. `claimPseudonym` catches the unique violation and reads
 * back — correct there, because nothing calls it inside a transaction. Here the
 * whole point is to run inside one, and **a raised error aborts the transaction
 * it was raised in**: the read that follows fails with "current transaction is
 * aborted", so the retry gets an exception instead of its answer. `on conflict`
 * never raises, so there is nothing to recover from.
 *
 * Runs inside the caller's transaction when it is given one, which is what lets
 * H.3 credit a quest inside the transaction that marks it claimed. Neither
 * happens without the other.
 */
export async function recordMovement(
  db: Db,
  movement: CoinMovementToRecord,
): Promise<MovementOutcome | null> {
  // The player must exist: the foreign key would say so anyway, but as a
  // rejection rather than as an answer, and the lock needs the row.
  const locked = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, movement.userId))
    .for('update');
  if (locked.length === 0) return null;

  const balance = await sumBalance(db, movement.userId);

  const [written] = await db
    .insert(coinMovement)
    .values({
      userId: movement.userId,
      amount: movement.amount,
      source: movement.source,
      reference: movement.reference ?? null,
      idempotencyKey: movement.idempotencyKey,
      balanceAfter: balance + movement.amount,
    })
    .onConflictDoNothing({
      target: [coinMovement.userId, coinMovement.idempotencyKey],
    })
    .returning({
      id: coinMovement.id,
      amount: coinMovement.amount,
      source: coinMovement.source,
      reference: coinMovement.reference,
      balanceAfter: coinMovement.balanceAfter,
      createdAt: coinMovement.createdAt,
    });

  if (written !== undefined) return { movement: written, fresh: true };

  // The key has been used. Hand back what it bought the first time, which is
  // the answer a retry is actually asking for.
  const existing = await selectMovementByKey(
    db,
    movement.userId,
    movement.idempotencyKey,
  );
  return existing === null ? null : { movement: existing, fresh: false };
}

/**
 * The balance, added up from every movement — the **audit** path, step H.2.
 *
 * `selectBalance` is what a screen calls; this is what proves it. One is a sum
 * over every row a player has and the other is one row, so they answer the same
 * question at different costs — and `coins-volume.test.ts` asserts they agree on
 * an account with thousands of movements. That equality is what makes the fast
 * read trustworthy, which is the arrangement E.4 used for `player_stats`.
 *
 * `coalesce(sum(...), 0)` so a player with no movements has a balance of zero
 * rather than null: nobody has ever earned a coin is a balance, not an absence.
 */
export async function sumBalance(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ balance: sql<number>`coalesce(sum(${coinMovement.amount}), 0)::int` })
    .from(coinMovement)
    .where(eq(coinMovement.userId, userId));

  return row?.balance ?? 0;
}

/**
 * `seq desc`, spelled so the index can actually serve it.
 *
 * **`order by seq desc` is `desc nulls first` in SQL**, and the index is
 * `(user_id, seq desc nulls last)` — which drizzle's `.desc()` produces for an
 * index but *not* for an order by. The two do not match, so Postgres cannot use
 * the index for the ordering: it read every one of the player's movements and
 * sorted them.
 *
 * Measured on five thousand movements, before and after:
 *
 *     order by seq desc              cost 139   0.77 ms   Seq Scan + top-N sort
 *     order by seq desc nulls last   cost 0.35  0.08 ms   Index Scan, no sort
 *
 * Ten times faster, and constant rather than linear — which is the whole reason
 * `balance_after` exists. `seq` is `not null`, so the two orderings can never
 * differ in *result*; they differ only in whether an index may be used, which is
 * exactly the kind of defect that ships quietly.
 */
const newestFirst = sql`${coinMovement.seq} desc nulls last`;

/**
 * The balance, read from the newest movement — step H.2, and the fast path.
 *
 * **One row, not a sum.** A balance is shown on every screen that mentions
 * coins, and adding up a ledger that grows for ever is the cost that arrives
 * quietly: it is nothing at ten movements and a table scan at ten thousand.
 * `balance_after` exists precisely so this read is one index seek, and the
 * `(user_id, seq desc)` index is what makes it stop at the first row.
 *
 * **Ordered by `seq` and never by `created_at`.** `now()` is the transaction's
 * start time, so two movements written together share a timestamp and "the
 * newest" would be a coin toss — one that can return the *earlier* balance. H.3
 * credits inside the transaction that claims a quest, so that is the ordinary
 * case.
 *
 * And ordered `nulls last`, for the reason above `newestFirst`: without it the
 * index cannot be used at all.
 *
 * Zero for a player with no movements, which is a balance rather than an
 * absence — and the same answer `sumBalance` gives, so the two agree from the
 * very first read.
 */
export async function selectBalance(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ balanceAfter: coinMovement.balanceAfter })
    .from(coinMovement)
    .where(eq(coinMovement.userId, userId))
    .orderBy(newestFirst)
    .limit(1);

  return row?.balanceAfter ?? 0;
}

/** The balance read, exported so a test can read the plan it sends. */
export function balanceQuery(db: Db, userId: string) {
  return db
    .select({ balanceAfter: coinMovement.balanceAfter })
    .from(coinMovement)
    .where(eq(coinMovement.userId, userId))
    .orderBy(newestFirst)
    .limit(1);
}

/** One movement by the key that made it, for a retry that wants its answer. */
export async function selectMovementByKey(
  db: Db,
  userId: string,
  idempotencyKey: string,
): Promise<RecordedMovement | null> {
  const [row] = await db
    .select({
      id: coinMovement.id,
      amount: coinMovement.amount,
      source: coinMovement.source,
      reference: coinMovement.reference,
      balanceAfter: coinMovement.balanceAfter,
      createdAt: coinMovement.createdAt,
    })
    .from(coinMovement)
    .where(
      and(
        eq(coinMovement.userId, userId),
        eq(coinMovement.idempotencyKey, idempotencyKey),
      ),
    );

  return row ?? null;
}

/** The ledger a person reads, newest first. */
export function movementsOf(db: Db, userId: string, limit = 50) {
  return (
    db
      .select({
        id: coinMovement.id,
        amount: coinMovement.amount,
        source: coinMovement.source,
        reference: coinMovement.reference,
        balanceAfter: coinMovement.balanceAfter,
        createdAt: coinMovement.createdAt,
      })
      .from(coinMovement)
      .where(eq(coinMovement.userId, userId))
      // By `seq` as well as by the clock: two movements written in one
      // transaction share a `created_at`, and a history that shuffled them would
      // show a spend before the credit that paid for it.
      .orderBy(desc(coinMovement.createdAt), desc(coinMovement.seq))
      .limit(limit)
  );
}

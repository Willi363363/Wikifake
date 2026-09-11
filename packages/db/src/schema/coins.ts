// Every coin that has ever existed — step H.1.
//
// **A balance is the sum of its movements and never a column somebody can
// write.** That is the whole reason this table exists rather than an integer on
// `profile`, and the track says why: the day a purchase is added, the questions
// asked are *where did these coins come from*, *was this credit applied twice*,
// and *what does this balance owe to a refund*. A ledger answers all three by
// existing; a counter answers none, and converting one into the other after the
// fact means reconstructing history that was never recorded.
//
// Nothing here takes a payment. No price in currency, no provider, no checkout —
// H.8 documents the seam a purchase would attach to rather than building it.
import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { user } from './auth.js';

/**
 * Where a movement came from.
 *
 * An enum and not text, which is the opposite of `quest_assignment.rule_id` and
 * for the opposite reason: the quest catalogue is *meant* to grow, and this list
 * is not. Adding a way for coins to come into existence should be a migration
 * somebody had to write, because it is a change to what money means here.
 *
 * The five are the plan's own list, and each names the step that first writes
 * it. `adjustment` is the exception and is here deliberately: **a ledger with no
 * way to correct it is a ledger somebody corrects by hand**, and a hand-edited
 * ledger is one nobody can audit afterwards. Track I's admin panel is what will
 * use it, through a row like any other.
 */
export const coinSourceEnum = pgEnum('coin_source', [
  /** H.3 — a quest claimed. F.6 marks the claim; this pays it. */
  'quest_reward',
  /** H.3 — finishing a round. */
  'round_end',
  /** H.4 — a hint bought with coins instead of score. */
  'hint_purchase',
  /** H.6 — a cosmetic. Nothing that can change a round's outcome. */
  'cosmetic_purchase',
  /** A correction, made by a person, recorded as a movement like any other. */
  'adjustment',
]);

export const coinMovement = pgTable(
  'coin_movement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    /**
     * Signed: a credit is positive, a spend is negative.
     *
     * One column rather than an amount and a direction, because two columns can
     * disagree — a negative credit is a row that means nothing, and no check
     * would catch it without knowing which of the two to trust. A sum over this
     * column is the balance, with no `case` in it.
     *
     * Never zero: a movement of nothing is a row that says something happened
     * when nothing did, and the check below refuses it.
     */
    amount: integer('amount').notNull(),

    source: coinSourceEnum('source').notNull(),

    /**
     * What the movement was about, for a person reading the ledger.
     *
     * A quest's rule identifier, a cosmetic's, the round's id. Text and
     * nullable, because it means something different per source and an
     * `adjustment` may have nothing but a reason.
     */
    reference: text('reference'),

    /**
     * The key that makes a credit safe to retry — the plan's own requirement.
     *
     * Unique **per player**, not globally: two players claiming the same quest
     * on the same day would otherwise collide on a key derived from the quest,
     * and the first to arrive would silently deny the second. So the constraint
     * is `(user_id, idempotency_key)` and callers may build keys out of what
     * they know without also having to make them universally unique.
     */
    idempotencyKey: text('idempotency_key').notNull(),

    /**
     * The balance after this movement — the plan asks for it, and it is the one
     * denormalisation here.
     *
     * **It is safe only because a movement is written under a lock on the
     * player.** Two credits arriving together would otherwise both read the same
     * balance and both write the same total, leaving a ledger whose last row
     * disagrees with the sum of its rows. `recordMovement` takes that lock;
     * `coins.test.ts` races ten credits on four connections and asserts the sum
     * and the last `balance_after` agree.
     *
     * What it buys is the audit the track is really asking for: a gap or a
     * repeat is visible in a single row rather than by re-adding the column, and
     * H.2's balance read can be checked against it.
     */
    balanceAfter: integer('balance_after').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    /**
     * The order movements were written in — step H.2, and it exists because
     * `created_at` cannot answer that question.
     *
     * **`now()` is the transaction's start time, not the clock's**, so two
     * movements written in one transaction carry the *identical* `created_at` —
     * verified against Postgres rather than assumed. H.3 will credit a quest in
     * the transaction that marks it claimed, and H.4 will spend in the one that
     * bills a hint, so that is the ordinary case and not a rare one.
     *
     * A balance read that takes "the newest row" would then be picking between
     * two rows at random and could return the *earlier* balance. `seq` makes the
     * order total: a sequence is handed out per insert, whatever the clock says.
     *
     * Global rather than per player, because a global sequence is one object
     * Postgres maintains and a per-player counter is a second thing to lock. The
     * gaps a rolled-back transaction leaves do not matter: nothing reads the
     * value, only its order.
     */
    seq: bigserial('seq', { mode: 'number' }).notNull(),
  },
  (table) => [
    /** The idempotency the exit gate names: the same key credits once. */
    unique('coin_movement_key').on(table.userId, table.idempotencyKey),
    /**
     * The ledger a person scrolls, newest first.
     *
     * This carried the balance read as well until H.2 found that `created_at`
     * cannot order two movements written in one transaction. It keeps the
     * history — where a same-second tie is a cosmetic question — and the index
     * below answers the balance.
     */
    index('coin_movement_user_idx').on(table.userId, table.createdAt.desc()),
    /**
     * H.2's balance read: one row, the newest this player has.
     *
     * `seq desc` and not `created_at desc`, for the reason on that column. The
     * balance is then an index scan that stops at the first row — measured in
     * `coins-volume.test.ts` on an account with thousands of movements, because
     * a balance is read on every page that shows one.
     */
    index('coin_movement_balance_idx').on(table.userId, table.seq.desc()),
    /**
     * H.6's ownership read: does this player own this cosmetic.
     *
     * **The index that makes deriving ownership from the ledger affordable**,
     * which is what H.6 chose over a `cosmetic_ownership` table: owning a
     * cosmetic is having a `cosmetic_purchase` movement for it, so there is no
     * second place that can disagree about what somebody owns, and *why* they
     * own it is answerable from the same rows as where their coins went.
     *
     * Partial, on `source`, and that is what makes it small: a purchase is a
     * handful of rows in a ledger that grows by two coins every round, so an
     * index over every movement would be almost entirely rows this query never
     * wants. `reference` is the cosmetic's identifier — the same column a quest
     * reward puts a rule id in, which is why the predicate is needed to tell
     * them apart. `cosmetics.test.ts` drops the index and watches the plan turn
     * into a scan, rather than asserting the shape and hoping.
     */
    index('coin_movement_owned_idx')
      .on(table.userId, table.reference)
      .where(sql`${table.source} = 'cosmetic_purchase'`),
    /**
     * A movement of nothing is not a movement.
     *
     * There is deliberately **no check that the balance stays positive.** That
     * is a rule about spending and it belongs to the step that spends — H.4 —
     * where refusing is a sentence a player can act on. A constraint here would
     * make an overdraft a database error on a path that cannot explain itself,
     * and would make a correction impossible to record.
     */
    check('coin_movement_amount_not_zero', sql`${table.amount} <> 0`),
  ],
);

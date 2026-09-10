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
  },
  (table) => [
    /** The idempotency the exit gate names: the same key credits once. */
    unique('coin_movement_key').on(table.userId, table.idempotencyKey),
    /**
     * H.2's balance read, and the ledger a person scrolls.
     *
     * `created_at desc` because both want the newest first — a balance is the
     * last row's `balance_after` and a history is read backwards.
     */
    index('coin_movement_user_idx').on(table.userId, table.createdAt.desc()),
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

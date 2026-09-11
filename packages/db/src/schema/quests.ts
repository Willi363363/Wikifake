// A quest a player has been given — step F.3.
//
// **One table, and the plan said two.** F.3 was written as
// `quest_assignment` *and* `quest_progress`, and F.4 says in the same file that
// progress is derived from the events the game already writes. Both cannot be
// true: every tally and every qualifier the catalogue declares is answerable by
// one aggregate over `participant` joined to `game` inside the period's window,
// so a progress table would be a second copy of a number that already exists —
// and "a stored column that can disagree with its own inputs is a bug with a
// schema" is the rule `player_stats` was designed around. The step was re-cut
// rather than implemented as written; `../../../plans/product/06-quests-steps.md`
// carries the argument.
//
// What *is* stored is the assignment, because it is a **promise** rather than a
// derivation. See `target` below.
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

/** The two periods `@wikifake/domain`'s `QuestPeriod` declares. */
export const questPeriodEnum = pgEnum('quest_period', ['daily', 'weekly']);

export const questAssignment = pgTable(
  'quest_assignment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    period: questPeriodEnum('period').notNull(),

    /**
     * Which day, or which week — `periodIndexOf` in `@wikifake/domain`.
     *
     * An integer and not a date, which is that function's decision and not this
     * table's: UTC days since the epoch, or Monday-aligned weeks since it. Two
     * consequences worth having written down here, where somebody reading a row
     * will be. A `period_index` of 20706 is 2026-09-10 and means nothing on
     * sight — the trade for arithmetic that cannot get a leap year wrong. And
     * comparing indices across periods is meaningless: day 20706 and week 2958
     * are the same Thursday.
     */
    periodIndex: integer('period_index').notNull(),

    /**
     * The catalogue rule this quest came from — `QuestRuleId` over there.
     *
     * **`text` and deliberately not a `pgEnum`**, which is the opposite of what
     * `item_id` does. Three reasons, and the third is the one that decides it:
     * `db` may not import `@wikifake/domain` — `workspace-graph.test.ts` refuses
     * it, because data does not depend on rules — and the identifiers are not in
     * `protocol` until F.7 puts them on the wire. The quest catalogue is also
     * *meant* to grow, and an enum makes every new rule a migration. And a rule
     * that is retired still has rows naming it: an enum value cannot be dropped
     * while a row holds it, whereas text simply survives, and the reader has to
     * tolerate an identifier the catalogue no longer knows either way.
     */
    ruleId: text('rule_id').notNull(),

    /**
     * The number drawn from the rule's range — and the reason this row exists.
     *
     * The generator is deterministic *given the catalogue*, so the target is
     * reproducible right up until somebody widens a rule's range. Storing it is
     * what freezes the promise: a player who has found four of a required six
     * keeps needing six, even after an edit that would have drawn eight.
     *
     * The reward is **not** stored, and that asymmetry is a decision. A target
     * is what a draw produced; a reward is what the catalogue says a rule pays,
     * with one place to read it. So changing a reward does change what an
     * unclaimed quest pays — deliberately, since the alternative is honouring an
     * economy we have retired. F.6 reads the catalogue when it credits.
     */
    target: integer('target').notNull(),

    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),

    /**
     * When the reward was taken. Null is the ordinary state of a live quest.
     *
     * The column is here rather than in F.6 because being claimed is a state of
     * an assignment and not a thing of its own — the same argument that put
     * track I's two figures in `player_stats` at E.4. What F.6 owns is the
     * transaction that sets it, and the guarantee that it is set once.
     */
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
  },
  (table) => [
    /**
     * What makes the cron idempotent, and it is a constraint rather than a
     * convention.
     *
     * F.5's exit gate is "the cron is run twice for the same date and nothing is
     * duplicated". The generator's determinism means a second run produces the
     * identical set; this is what makes writing it again a no-op instead of a
     * second row. Without it, idempotence would be a `select` the second run
     * races with the first.
     */
    unique('quest_assignment_key').on(
      table.userId,
      table.period,
      table.periodIndex,
      table.ruleId,
    ),
    /** The only read there is: this player's set for this day, or this week. */
    index('quest_assignment_set_idx').on(table.userId, table.period, table.periodIndex),
    /**
     * A target of zero is a quest that is complete before it is assigned, and a
     * negative one is complete for ever. `quests.test.ts` in `domain` refuses
     * both in the catalogue; this refuses them in a row, which is the half that
     * survives a caller doing its own arithmetic.
     */
    check('quest_assignment_target_positive', sql`${table.target} > 0`),
  ],
);

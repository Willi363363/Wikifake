// A score that is eligible to be ranked — step G.2.
//
// **A row exists here if and only if a round was finished and graded by the
// server**, which is the track's anti-cheat rule turned into a table rather than
// a `where` clause every query has to remember. `participant` can express the
// same thing — its own check ties `submitted_at` to `score` — so this table is
// not the only way to be correct; it is the way that cannot be got wrong by the
// next query somebody writes.
//
// That was put to the owner as a fork, with the cost named: a second write path,
// and a figure that can drift from `participant`. Both are answered rather than
// accepted. The write is **inside `recordSubmission`'s transaction**, so an
// entry cannot exist without the grading it came from; and
// `leaderboard.test.ts` rebuilds the table from `participant` rows and asserts
// the two agree, which is the same trick E.4 used to make `player_stats`
// trustworthy.
//
// **The region is not here.** It is `profile`'s, joined at query time, because a
// player may change it — G.1 — and a denormalised copy would mean rewriting
// history every time somebody travels. What is denormalised is only what cannot
// change once a round is over: the score, the mode, and the instant.
import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { user } from './auth.js';
import { gameMode, participant } from './game.js';

export const leaderboardEntry = pgTable(
  'leaderboard_entry',
  {
    /**
     * The participant row this score came from, and the primary key.
     *
     * **One entry per participation, enforced by being the key itself** rather
     * than by a unique index beside a surrogate id: a round is graded once —
     * `recordSubmission` updates `where submitted_at is null` — so a second
     * entry for the same participation is not a duplicate to tidy up, it is a
     * score that was never earned.
     *
     * `cascade`, so a game deleted for any reason takes its entries with it. A
     * board must not outlive the rounds it ranks.
     */
    participantId: uuid('participant_id')
      .primaryKey()
      .references(() => participant.id, { onDelete: 'cascade' }),

    /**
     * Whose score it is.
     *
     * `set null` and not `cascade`, which is E.7's shape: deleting an account
     * leaves the rounds it played coherent. A board then has a row with no
     * owner, and the queries of G.4 must not show it — there is no pseudonym to
     * print and nobody to rank. Kept rather than deleted because the *game* it
     * belongs to is still real, and its other players' ranks are computed
     * against the field that played.
     */
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),

    /**
     * Solo and multiplayer are ranked apart, which the track requires: "a solo
     * game against a self-chosen topic is ranked separately from multiplayer,
     * or not at all. The two are not comparable."
     *
     * Denormalised from `game`, and safe to be: a game's mode is decided when
     * it is created and nothing changes it.
     */
    mode: gameMode('mode').notNull(),

    /** What the server graded. Negative is possible — C2.3 does not clamp. */
    score: integer('score').notNull(),

    /**
     * When the round was finished, which is what a period is measured on.
     *
     * `submitted_at` and not `started_at`, for F.4's reason: a round's numbers
     * do not exist until it is graded, and starting a round before midnight
     * must not let a player choose which day it counts for.
     */
    finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
  },
  (table) => [
    /**
     * The board, as one index: a period is a range on `finished_at` and a board
     * is ordered by score.
     *
     * G.4 is the step that checks this holds its plan on seeded volume, and it
     * may well replace it — the index goes in with the query, and the query is
     * G.4's. What is here is the shape the boards will ask for: mode first
     * because every board filters on exactly one, then the range, then the
     * order.
     */
    index('leaderboard_mode_finished_idx').on(table.mode, table.finishedAt, table.score),
    /**
     * The all-time board, which the index above cannot serve.
     *
     * **Added by G.4 because its volume test refused the query**, which is the
     * point of that test rather than an accident of it. With no window there is
     * no range on `finished_at`, so an index that puts that column before
     * `score` cannot deliver the order — and Postgres chose a sequential scan of
     * 25,000 rows and a sort. Measured, not guessed:
     *
     *     Seq Scan on leaderboard_entry  (rows=24965)  ->  Sort  ->  Limit
     *
     * `score desc` in the index, because that is the direction every board reads.
     * All four board columns in the order the query asks for them — including
     * `participant_id`, the third tie-break — so the index can deliver the
     * ordering with **no sort at all**; three of four leaves an incremental
     * sort, which is what the volume test measures.
     *
     * Partial on `user_id is not null`, because every board carries that clause:
     * a row with no owner has no name to print, and leaving those out makes the
     * index smaller as well as exactly matched.
     *
     * **Whether the planner picks it depends on the table's size, and that is
     * not this index's business.** At fifty thousand narrow rows Postgres
     * prefers a scan and a sort, correctly — the table is eight megabytes. What
     * the schema has to guarantee is that an index *can* serve the query's order
     * when the table is large enough to matter, and that is what the volume test
     * asserts, with `enable_seqscan` off to take the cost model out of it.
     */
    index('leaderboard_mode_score_idx')
      .on(table.mode, table.score.desc(), table.finishedAt, table.participantId)
      .where(sql`${table.userId} is not null`),
    /** For "your own rank, and the rows around it" — G.7. */
    index('leaderboard_user_idx').on(table.userId),
    // No check constraint here, deliberately. The one this file first carried
    // was `score is not null` beside a `not null` column — a constraint no
    // insert can violate, which is worse than none: it reads as a guarantee
    // somebody checked. C2.3 lets a score be negative and nothing clamps it, so
    // there is no range to refuse either.
  ],
);

// What a player has done, in one row — step E.4.
//
// **An aggregate, maintained rather than computed.** `05-accounts.md` is
// explicit: written when a round ends, never recomputed from scratch on a page
// load. A profile that runs a `group by` over every game a player has ever
// played is a profile that gets slower for exactly the players who use it most,
// and the same numbers are read again by the admin panel's activation KPI in
// track I.
//
// **What is stored and what is not.** Three of the plan's figures are
// deliberately absent, because each is one subtraction or one division from
// what is here: games *abandoned* is played minus finished, *average score* is
// the total over the finished count, and *accuracy* is found over found plus
// missed. A column that can disagree with its own inputs is a bug with a
// schema; `queries/stats.ts` derives them on the way out.
//
// **`total_score` is the exception, and it is here for the division above.**
// C2.3 lets a score be negative and does not clamp it, so this sum can be
// negative too, and an average can be. That is the truth about a player who
// marks everything and buys every reveal.
import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { user } from './auth.js';

export const playerStats = pgTable(
  'player_stats',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),

    /** Rounds joined. Incremented when the game is created, not when it ends. */
    gamesPlayed: integer('games_played').notNull().default(0),
    /** Rounds submitted. The difference from `gamesPlayed` is what was abandoned. */
    gamesFinished: integer('games_finished').notNull().default(0),

    /** C2.1's three outcomes, summed over every finished round. */
    falsificationsFound: integer('falsifications_found').notNull().default(0),
    falsificationsMissed: integer('falsifications_missed').notNull().default(0),
    paragraphsWronglyMarked: integer('paragraphs_wrongly_marked').notNull().default(0),

    /** Null until a first round is finished: no score is not a score of zero. */
    bestScore: integer('best_score'),
    /** The numerator of the average. Negative is possible, and is not an error. */
    totalScore: integer('total_score').notNull().default(0),

    /**
     * Consecutive perfect rounds — `isPerfectRound` in `@wikifake/domain`.
     *
     * Every falsification found and nothing true marked. The definition is a
     * decision rather than a deduction and it lives there, in one predicate, so
     * that changing it is one function and a recomputation rather than a search.
     */
    currentStreak: integer('current_streak').notNull().default(0),
    bestStreak: integer('best_streak').notNull().default(0),

    /**
     * The two the admin panel reads, named here rather than invented twice.
     *
     * `firstSeen` is the row's own creation; `lastSeen` moves on every round
     * started or finished. Track I's activation KPI is the pair of them against
     * `gamesFinished`.
     */
    firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * I.3 — "how many played today", which is a range on this column.
     *
     * Without it the count is a scan of every account the game has ever had, on
     * a page whose exit gate asks for under a second. `admin-players.test.ts`
     * drops the index and watches the plan turn into one, rather than asserting
     * a shape and hoping.
     */
    index('player_stats_last_seen_idx').on(table.lastSeen),
    /**
     * I.3 — the most active players, which is this column ordered.
     *
     * `desc` spelled here and `desc nulls last` written into the index by
     * Drizzle, which H.2 found the hard way: `order by x desc` means `nulls
     * first`, so a query ordering without `nulls last` cannot use an index that
     * has it. The column is `not null`, so the two agree either way — and the
     * query says `nulls last` anyway, because relying on a column staying
     * non-null is relying on the wrong thing.
     */
    index('player_stats_finished_idx').on(table.gamesFinished.desc()),
  ],
);

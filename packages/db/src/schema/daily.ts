// The article of the day — step N.1.
//
// One row per day, keyed by `periodIndexOf('daily')` in `@wikifake/domain`: the
// **same calendar as the quests**, deliberately. A `date` column needs a timezone
// to mean a day, track F already answered that question for this product, and
// two calendars in one product is one of them being wrong somewhere.
//
// **A row with no article is not a broken row, it is a claim.** Generating the
// day's article costs a model call, and fifty players arriving at midnight must
// not buy fifty articles — so a caller claims the day with an insert that either
// returns a row or does not, and only the caller holding the claim generates.
// Every other caller reads. That is why every article column below is nullable
// and `claimed_at` is not: a row exists because somebody claimed it.
//
// **The article is stored, not the topic.** Two players handed the topic *Tour
// Eiffel* do not play the same round — the model falsifies afresh and the
// sentences differ — so what has to be one for everybody is the generated
// artefact. The shape is `game`'s, because it is the same thing: paragraphs as
// served, and the solution beside them.
//
// **The solution is `jsonb` here and a table over there.** `game_position` earns
// its rows by being queried per game and constrained per falsification; this is a
// *template* nothing queries inside. It is copied into `game_position` when a
// player starts their round, which is N.4, and a second constrained table for
// rows nobody reads individually would be a join for no question.
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const dailyArticle = pgTable(
  'daily_article',
  {
    /** `periodIndexOf('daily', at)` — epoch day. The quests' calendar. */
    day: integer('day').primaryKey(),

    /**
     * When the claim was taken, and the only column that is never null.
     *
     * It is what lets N.3 tell a generation still running from one that died: a
     * row claimed four seconds ago is somebody working, a row claimed an hour
     * ago with no article is a crash, and without the instant the two look
     * identical and the day would serve nothing for ever.
     */
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),

    /** The resolved Wikipedia title — `article.topic`, not what anybody typed. */
    topic: text('topic'),
    /** C6.1 — the source link, part of the attribution. */
    sourceUrl: text('source_url'),
    /** The falsified paragraphs, as they will be served. A snapshot. */
    paragraphs: jsonb('paragraphs'),
    /** The solution, as a template: `game_position`'s columns, one per falsification. */
    solution: jsonb('solution'),
    totalFakes: integer('total_fakes'),
    /** Null while the claim is open. Set in the same statement that fills the rest. */
    generatedAt: timestamp('generated_at', { withTimezone: true }),
  },
  (table) => [
    /*
     * Filled or not filled, never half. The five article columns are written by
     * one statement, so a row carrying paragraphs but no solution could only come
     * from a hand edit or a future bug — and a day served with no solution is a
     * round nobody can be graded on.
     *
     * `generated_at` is the one the check keys on because it is the one the read
     * path asks about: "is this day ready" is a null test on a single column
     * rather than five.
     */
    check(
      'daily_article_filled_together',
      sql`(${table.generatedAt} is null) = (${table.paragraphs} is null
        and ${table.solution} is null
        and ${table.topic} is null
        and ${table.sourceUrl} is null
        and ${table.totalFakes} is null)`,
    ),
    check(
      'daily_article_fakes_positive',
      sql`${table.totalFakes} is null or ${table.totalFakes} >= 1`,
    ),
    /*
     * N.3 sweeps for claims that were never filled. Without this the sweep is a
     * scan of every day the game has ever had — small for a year, and the index
     * costs one column on a table that gains one row a day.
     */
    index('daily_article_open_claims_idx').on(table.generatedAt, table.claimedAt),
  ],
);

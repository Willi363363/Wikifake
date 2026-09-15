// The day's article: claiming it, filling it, reading it — step N.1.
//
// **This module counts nothing and decides nothing.** It does not know what a
// day is — `periodIndexOf` in `@wikifake/domain` does, and `db` may not import
// it — nor how long a claim may stay open, which is N.3's policy. It offers the
// three statements the shape needs and lets the caller say which day and which
// deadline.
import { and, eq, isNull, lt, sql } from 'drizzle-orm';

import type { Database } from '../client.js';
import { dailyArticle } from '../schema/daily.js';

// The same pair every query module uses: a connection or a transaction, so a
// caller can run the claim and the fill inside one.
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** The article a day holds, once it has one. */
export interface DailyArticle {
  readonly day: number;
  readonly topic: string;
  readonly sourceUrl: string;
  readonly paragraphs: unknown;
  readonly solution: unknown;
  readonly totalFakes: number;
  readonly generatedAt: Date;
}

/** What a day looks like before anybody has filled it. */
export interface OpenClaim {
  readonly day: number;
  readonly claimedAt: Date;
}

/**
 * Take the day, or find it already taken — the statement the whole track turns
 * on.
 *
 * **True means generate; false means read.** Exactly one caller can be told
 * true for a given day, because `day` is the primary key and `on conflict do
 * nothing` makes the second insert write nothing and return nothing. That is
 * what stops fifty players arriving at midnight from buying fifty articles.
 *
 * It is deliberately not "claim if nobody has generated yet". A row is a claim
 * whether or not it has an article, so a caller that crashed mid-generation
 * keeps the day until somebody releases it — `reopenStaleClaim` below, on N.3's
 * policy rather than on this module's opinion.
 */
export async function claimDay(db: Db, day: number, at: Date): Promise<boolean> {
  const rows = await db
    .insert(dailyArticle)
    .values({ day, claimedAt: at })
    .onConflictDoNothing({ target: dailyArticle.day })
    .returning({ day: dailyArticle.day });

  return rows.length > 0;
}

/**
 * Fill a day that was claimed. Every article column, in one statement.
 *
 * Scoped to a row that has none: filling twice is not an error a caller should
 * have to avoid, it is a write that does nothing. The `check` on the table makes
 * a half-filled row impossible; this makes a *re*-filled one impossible too, so
 * a retried generation cannot replace the article players are already reading.
 */
export async function fillDay(
  db: Db,
  day: number,
  article: {
    readonly topic: string;
    readonly sourceUrl: string;
    readonly paragraphs: unknown;
    readonly solution: unknown;
    readonly totalFakes: number;
  },
  at: Date,
): Promise<boolean> {
  const rows = await db
    .update(dailyArticle)
    .set({ ...article, generatedAt: at })
    .where(and(eq(dailyArticle.day, day), isNull(dailyArticle.generatedAt)))
    .returning({ day: dailyArticle.day });

  return rows.length > 0;
}

/**
 * The day's article, or null — which answers two questions at once.
 *
 * Null means *not ready*, and a caller cannot tell "nobody claimed it" from
 * "somebody is generating it" here. That is on purpose: both mean the same thing
 * to a screen, and the distinction only matters to the cron, which asks
 * `openClaimsBefore`.
 */
export async function selectDay(db: Db, day: number): Promise<DailyArticle | null> {
  const [row] = await db
    .select()
    .from(dailyArticle)
    .where(and(eq(dailyArticle.day, day), sql`${dailyArticle.generatedAt} is not null`))
    .limit(1);

  if (row === undefined) return null;

  return {
    day: row.day,
    // The check constraint ties these to `generated_at`, so a row that passed
    // the `is not null` above carries all five. Asserted rather than defaulted:
    // a `?? ''` here would serve an article with no title and call it fine.
    topic: row.topic as string,
    sourceUrl: row.sourceUrl as string,
    paragraphs: row.paragraphs,
    solution: row.solution,
    totalFakes: row.totalFakes as number,
    generatedAt: row.generatedAt as Date,
  };
}

/**
 * Give the day back, now — step N.3.
 *
 * `reopenStaleClaim` is for a generation that **died**: it takes a deadline
 * because nothing can tell a crash from work in progress except time. This one
 * is for a generation that failed and knows it — Wikipedia unreachable, the
 * model refusing — where waiting an hour for a sweep would leave the day empty
 * for no reason.
 *
 * Scoped to a row with no article, like everything else that deletes here. A
 * caller cannot release a day players are reading even by asking.
 */
export async function releaseClaim(db: Db, day: number): Promise<boolean> {
  const rows = await db
    .delete(dailyArticle)
    .where(and(eq(dailyArticle.day, day), isNull(dailyArticle.generatedAt)))
    .returning({ day: dailyArticle.day });

  return rows.length > 0;
}

/** Claims taken before `before` and never filled — a generation that died. */
export async function openClaimsBefore(
  db: Db,
  before: Date,
): Promise<readonly OpenClaim[]> {
  return db
    .select({ day: dailyArticle.day, claimedAt: dailyArticle.claimedAt })
    .from(dailyArticle)
    .where(and(isNull(dailyArticle.generatedAt), lt(dailyArticle.claimedAt, before)))
    .orderBy(dailyArticle.day);
}

/**
 * Give a dead claim back, so the next caller can take it.
 *
 * A delete rather than a flag: a claim is the row's existence, so releasing one
 * is removing it. Scoped to a row with no article, which is what makes this
 * unable to delete a day players are reading — the deadline is the caller's
 * policy, the safety is not.
 */
export async function reopenStaleClaim(
  db: Db,
  day: number,
  before: Date,
): Promise<boolean> {
  const rows = await db
    .delete(dailyArticle)
    .where(
      and(
        eq(dailyArticle.day, day),
        isNull(dailyArticle.generatedAt),
        lt(dailyArticle.claimedAt, before),
      ),
    )
    .returning({ day: dailyArticle.day });

  return rows.length > 0;
}

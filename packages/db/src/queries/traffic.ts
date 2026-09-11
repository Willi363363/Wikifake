// Step J.4 — counting a page load, and reading the counts back.
//
// One statement per load, and the increment happens **inside** it: two arrivals
// in the same millisecond each reading the old number and writing it back is
// the classic lost update, and at the one moment this table matters — a link
// somewhere busy — it is not a rare race, it is the traffic.
import { and, gte, lte, sql } from 'drizzle-orm';

import { pageView } from '../schema/traffic.js';
import type { Database } from '../client.js';

type Db = Database['db'];

/** A UTC day, as `YYYY-MM-DD`, which is what a `date` column takes. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Counts one load of one page.
 *
 * The clock is a parameter, like everywhere else in this codebase that measures
 * a day: a query that reads `new Date()` is a query no test can put on either
 * side of midnight.
 */
export async function recordPageView(db: Db, page: string, at: Date): Promise<void> {
  await db
    .insert(pageView)
    .values({ day: utcDay(at), page, views: 1 })
    .onConflictDoUpdate({
      target: [pageView.day, pageView.page],
      set: { views: sql`${pageView.views} + 1` },
    });
}

export interface DailyViews {
  readonly day: string;
  readonly page: string;
  readonly views: number;
}

/**
 * Every counted day in a range, oldest first.
 *
 * Rows rather than a total: the panel of J.4b draws a series, and a sum of a
 * series is something the caller can do and the reverse is not.
 */
export async function selectPageViews(
  db: Db,
  from: Date,
  to: Date,
): Promise<DailyViews[]> {
  return db
    .select({ day: pageView.day, page: pageView.page, views: pageView.views })
    .from(pageView)
    .where(and(gte(pageView.day, utcDay(from)), lte(pageView.day, utcDay(to))))
    .orderBy(pageView.day, pageView.page);
}

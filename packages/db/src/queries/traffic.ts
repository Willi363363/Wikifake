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
 * A half-open window in milliseconds, as every ranged query in this package
 * takes one — `null` for all time.
 */
export interface Window {
  readonly fromMs: number;
  readonly toMs: number;
}

/**
 * The window, as the two days the `date` column can be compared against.
 *
 * The upper bound is the day containing the **last instant** of a half-open
 * window, not the day containing `toMs`. With `toMs` at a real clock reading —
 * which is what the panel passes — the two are the same day and today is
 * included, which is the point. With `toMs` at exactly midnight they differ,
 * and taking the earlier one is what keeps `from <= at < to` true at a day's
 * resolution rather than quietly including a day the caller excluded.
 */
function daysIn(window: Window): { first: string; last: string } {
  return {
    first: utcDay(new Date(window.fromMs)),
    last: utcDay(new Date(window.toMs - 1)),
  };
}

/**
 * Every counted day in a window, oldest first.
 *
 * Rows rather than a total: the panel draws a series, and a sum of a series is
 * something the caller can do while the reverse is not.
 */
export async function selectPageViews(
  db: Db,
  window: Window | null,
): Promise<DailyViews[]> {
  const columns = { day: pageView.day, page: pageView.page, views: pageView.views };
  const query = db.select(columns).from(pageView);

  if (window === null) return query.orderBy(pageView.day, pageView.page);

  const { first, last } = daysIn(window);
  return query
    .where(and(gte(pageView.day, first), lte(pageView.day, last)))
    .orderBy(pageView.day, pageView.page);
}

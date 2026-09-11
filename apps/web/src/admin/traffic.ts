// Arrivals — step J.4b, the reader for the counter J.4 writes.
//
// The section answers the one question the six before it cannot: **of the
// people who arrive, how many get as far as asking for a game**. Everything
// after that is a row in `game`, and the games section beside this one is where
// it is read.
//
// Two figures and a ratio, and the ratio is the section. A landing that doubles
// its arrivals and keeps the same reach did well; one that doubles them and
// halves its reach found the wrong audience.
import { selectPageViews, type Database, type DailyViews } from '@wikifake/db';

import { shareOf } from './activation.js';
import { windowOf, type Range } from './range.js';

export interface TrafficContext {
  readonly db: Database['db'];
}

/** One day, with the two pages side by side rather than as two rows. */
export interface TrafficDay {
  readonly day: string;
  readonly landing: number;
  readonly entry: number;
}

export interface TrafficView {
  readonly landing: number;
  readonly entry: number;
  /**
   * Entry views over landing views, or null when nothing arrived.
   *
   * Null and not zero, for `shareOf`'s reason, which this section needs more
   * than most: **nobody arrived** and *everybody who arrived left at once* are
   * the two states this panel exists to tell apart.
   *
   * It can exceed one, and that is not a defect: somebody can reach the entry
   * screen from a bookmark without passing the landing at all. A ratio above
   * 100% says the front door is not where players come in.
   */
  readonly reach: number | null;
  /** Most recent first — a dashboard is read from today backwards. */
  readonly days: readonly TrafficDay[];
  /**
   * The first day anything was counted, over all time and not over the range.
   *
   * The counter began the day J.4 shipped, so a 90-day range covers weeks that
   * were never counted, and a reader comparing this month with last would be
   * comparing a measurement with its own absence. Null when nothing has been
   * counted at all.
   */
  readonly since: string | null;
}

/** The two pages of one day, folded into a row. */
function fold(rows: readonly DailyViews[]): TrafficDay[] {
  const byDay = new Map<string, { landing: number; entry: number }>();

  for (const row of rows) {
    const day = byDay.get(row.day) ?? { landing: 0, entry: 0 };
    if (row.page === 'landing') day.landing += row.views;
    if (row.page === 'entry') day.entry += row.views;
    byDay.set(row.day, day);
  }

  return [...byDay.entries()]
    .map(([day, counts]) => ({ day, ...counts }))
    .sort((left, right) => right.day.localeCompare(left.day));
}

export async function readTraffic(
  context: TrafficContext,
  range: Range,
): Promise<TrafficView> {
  // Two reads, because `since` is a fact about the table and not about the
  // range: asking for it inside the window would answer "the first day of the
  // range", which is not a fact at all.
  const [ranged, everything] = await Promise.all([
    selectPageViews(context.db, windowOf(range)),
    selectPageViews(context.db, null),
  ]);

  const days = fold(ranged);
  const sum = (pick: (day: TrafficDay) => number) =>
    days.reduce((total, day) => total + pick(day), 0);

  const landing = sum((day) => day.landing);
  const entry = sum((day) => day.entry);

  return {
    landing,
    entry,
    reach: shareOf(entry, landing),
    days,
    since: everything[0]?.day ?? null,
  };
}

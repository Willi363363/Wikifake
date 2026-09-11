// Who plays, and how recently — step I.3.
//
// The layer that may hold both halves: `@wikifake/db` has the counts and
// `@wikifake/domain` has the calendar, and they may not import each other, so
// this is where *today* becomes an instant.
//
// **The same today as a daily quest and a daily board.** `periodWindowOf` is
// what G.3 moved out of the quest modules for exactly this reason: a panel that
// computed its own midnight would report a different Monday from the leaderboard
// beside it, and the two would both be defensible and disagree.
import {
  countAccounts,
  countActiveSince,
  countEverPlayed,
  selectMostActive,
  type ActivePlayer,
} from '@wikifake/db';
import { periodIndexOf, periodWindowOf } from '@wikifake/domain';
import type { Database } from '@wikifake/db';

import { windowOf, type Range } from './range.js';

export interface PlayersContext {
  readonly db: Database['db'];
}

/** How many names the most-active list shows. Short: it is a sample, not a board. */
export const MOST_ACTIVE = 10;

export interface PlayersView {
  /** Real accounts, excluding guests. */
  readonly accounts: number;
  /** Guest `user` rows, which the anonymous plugin creates and deletes. */
  readonly guests: number;
  /** Accounts that have ever finished a round. */
  readonly everPlayed: number;
  readonly activeToday: number;
  readonly activeThisWeek: number;
  /** Seen at any point in the chosen range. A range on `last_seen`. */
  readonly activeInRange: number;
  readonly mostActive: readonly ActivePlayer[];
}

/**
 * The players section, ready to render.
 *
 * `atMs` is a parameter like every clock here: the page passes now and a test
 * passes a Thursday. Five reads, run together — the page's cost is the slowest
 * rather than the sum, which is the same arrangement I.2's probes use and for
 * the same exit-gate reason.
 */
export async function readPlayers(
  context: PlayersContext,
  range: Range,
  atMs: number,
): Promise<PlayersView> {
  const today = periodWindowOf('daily', periodIndexOf('daily', atMs));
  const week = periodWindowOf('weekly', periodIndexOf('weekly', atMs));
  const cohort = windowOf(range);

  const [totals, everPlayed, activeToday, activeThisWeek, activeInRange, mostActive] =
    await Promise.all([
      countAccounts(context.db, cohort),
      countEverPlayed(context.db, cohort),
      countActiveSince(context.db, today.fromMs),
      countActiveSince(context.db, week.fromMs),
      // Not a cohort: *seen since* is a range on `last_seen`, which is the one
      // dated column `player_stats` has.
      countActiveSince(context.db, range.fromMs),
      // **All-time, whatever the range.** `games_finished` is a running total
      // with no date on it — E.4 keeps it as an aggregate maintained rather
      // than recomputed — so "most active this week" is a question the schema
      // cannot answer, and the screen says the list is all-time rather than
      // pretending otherwise.
      selectMostActive(context.db, MOST_ACTIVE),
    ]);

  return {
    accounts: totals.accounts,
    guests: totals.guests,
    everPlayed,
    activeToday,
    activeThisWeek,
    activeInRange,
    mostActive,
  };
}

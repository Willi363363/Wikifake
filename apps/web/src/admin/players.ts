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
  atMs: number,
): Promise<PlayersView> {
  const today = periodWindowOf('daily', periodIndexOf('daily', atMs));
  const week = periodWindowOf('weekly', periodIndexOf('weekly', atMs));

  const [totals, everPlayed, activeToday, activeThisWeek, mostActive] = await Promise.all(
    [
      countAccounts(context.db),
      countEverPlayed(context.db),
      countActiveSince(context.db, today.fromMs),
      countActiveSince(context.db, week.fromMs),
      selectMostActive(context.db, MOST_ACTIVE),
    ],
  );

  return {
    accounts: totals.accounts,
    guests: totals.guests,
    everPlayed,
    activeToday,
    activeThisWeek,
    mostActive,
  };
}

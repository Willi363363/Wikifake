// The day's board — step N.6.
//
// **No new table and no migration.** A daily round is a graded round like any
// other, so it is already in `leaderboard_entry`; what makes it the day's is
// `game.daily_day`, which N.5 put there. The board is that column narrowed.
//
// **And no `distinct on (user_id)`**, which is the whole difference from G.4's
// boards and worth stating rather than leaving as an absence. Those rank *each
// player's best round in a period*, because a player can play a period fifty
// times — G.7 found that the board listed entries instead, so one player took
// five of fifty rows and "your own rank" meant nothing. Here N.5 refuses a
// second attempt, so one player already has one round: the machinery would be
// answering a question the day cannot ask.
//
// It is the same rule read twice, which is why `daily_board.test.ts` asserts the
// one row per player rather than trusting this comment.
import { and, asc, desc, eq, gt, lt, or, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../client.js';
import { game, participant } from '../schema/game.js';
import { leaderboardEntry } from '../schema/leaderboard.js';
import { profile } from '../schema/profile.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** One row of the day's board. The rank is the row's position, not a column. */
export interface DailyBoardRow {
  readonly userId: string;
  readonly displayName: string;
  readonly score: number;
  readonly finishedAt: Date;
  /** H.6 — the frame this player is wearing, or null for the default. */
  readonly frame: string | null;
}

/**
 * Who played the day, and how they did.
 *
 * The inner join to `profile` does three jobs a `where` clause would have to
 * remember, and it is G.4's reason unchanged: a board shows names and only a
 * profile row has one, so a guest, an account with no pseudonym, and a deleted
 * account whose `user_id` E.7 set to null are all excluded. None has a name to
 * print or a rank to be given.
 *
 * **The order is total**, like G.4's: `score desc` is the board, `finished_at
 * asc` breaks a tie in favour of whoever got there first — the only tie-break a
 * player would call fair — and `user_id` breaks the remaining one so that two
 * reads return the same order rather than reshuffling between page loads.
 */
/**
 * The clause every read here shares, and the one place a day is defined.
 *
 * **The filters are shared and the joins are not**, which is G.4's shape rather
 * than a compromise: `boardFilters` exists because G.7 found three copies of the
 * same three *clauses* disagreeing about which period they meant, and the joins
 * were never the risk. Sharing those instead would mean a generic select whose
 * return type has to be cast back — and a cast in a query layer hides exactly
 * the mistake no test catches.
 */
function onDay(day: number, extra?: SQL | undefined) {
  return extra === undefined
    ? eq(game.dailyDay, day)
    : and(eq(game.dailyDay, day), extra);
}

/**
 * Who played the day, and how they did.
 *
 * The inner join to `profile` does three jobs a `where` clause would have to
 * remember, and it is G.4's reason unchanged: a board shows names and only a
 * profile row has one, so a guest, an account with no pseudonym, and a deleted
 * account whose `user_id` E.7 set to null are all excluded. None has a name to
 * print or a rank to be given.
 *
 * **The order is total**, like G.4's: `score desc` is the board, `finished_at
 * asc` breaks a tie in favour of whoever got there first — the only tie-break a
 * player would call fair — and `user_id` breaks the remaining one so that two
 * reads return the same order rather than reshuffling between page loads.
 */
export async function selectDailyBoard(
  db: Db,
  day: number,
  limit: number,
  offset = 0,
): Promise<readonly DailyBoardRow[]> {
  return db
    .select({
      userId: profile.userId,
      displayName: profile.displayName,
      score: leaderboardEntry.score,
      finishedAt: leaderboardEntry.finishedAt,
      frame: profile.wornFrame,
    })
    .from(leaderboardEntry)
    .innerJoin(participant, eq(participant.id, leaderboardEntry.participantId))
    .innerJoin(game, eq(game.id, participant.gameId))
    .innerJoin(profile, eq(profile.userId, leaderboardEntry.userId))
    .where(onDay(day))
    .orderBy(
      desc(leaderboardEntry.score),
      asc(leaderboardEntry.finishedAt),
      asc(profile.userId),
    )
    .limit(limit)
    .offset(offset);
}

/** How many players have finished the day. What the board's header counts. */
export async function countDailyPlayers(db: Db, day: number): Promise<number> {
  const [row] = await db
    .select({ players: sql<number>`count(distinct ${leaderboardEntry.userId})::int` })
    .from(leaderboardEntry)
    .innerJoin(participant, eq(participant.id, leaderboardEntry.participantId))
    .innerJoin(game, eq(game.id, participant.gameId))
    .innerJoin(profile, eq(profile.userId, leaderboardEntry.userId))
    .where(onDay(day));

  return row?.players ?? 0;
}

export interface DailyRank {
  readonly userId: string;
  readonly rank: number;
  readonly score: number;
  readonly finishedAt: Date;
}

/**
 * Where this player stands on the day, or null if they have not finished it.
 *
 * **Competition ranking**: one more than the number of players who did strictly
 * better, so two players tied share a rank — what every scoreboard a player has
 * ever read does, and the only reading that does not have to explain itself.
 *
 * Null is not last. A player who has not played today is not on this board, and
 * a screen says so rather than printing a number.
 *
 * "Strictly better" is the board's own tie-break — a higher score, or the same
 * one reached earlier — so a rank and the row order cannot disagree.
 */
export async function selectOwnDailyRank(
  db: Db,
  day: number,
  userId: string,
): Promise<DailyRank | null> {
  const [own] = await db
    .select({
      score: leaderboardEntry.score,
      finishedAt: leaderboardEntry.finishedAt,
    })
    .from(leaderboardEntry)
    .innerJoin(participant, eq(participant.id, leaderboardEntry.participantId))
    .innerJoin(game, eq(game.id, participant.gameId))
    .innerJoin(profile, eq(profile.userId, leaderboardEntry.userId))
    .where(onDay(day, eq(profile.userId, userId)));

  if (own === undefined) return null;

  const [ahead] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leaderboardEntry)
    .innerJoin(participant, eq(participant.id, leaderboardEntry.participantId))
    .innerJoin(game, eq(game.id, participant.gameId))
    .innerJoin(profile, eq(profile.userId, leaderboardEntry.userId))
    .where(
      onDay(
        day,
        or(
          gt(leaderboardEntry.score, own.score),
          and(
            eq(leaderboardEntry.score, own.score),
            lt(leaderboardEntry.finishedAt, own.finishedAt),
          ),
        ),
      ),
    );

  return {
    userId,
    rank: (ahead?.count ?? 0) + 1,
    score: own.score,
    finishedAt: own.finishedAt,
  };
}

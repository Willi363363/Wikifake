// Writing a score down so it can be ranked, and reading a board back — steps
// G.2 and G.4.
//
// The first two functions exist to make each other trustworthy; the last three
// are the boards.
//
// `recordEligibleScore` is called from inside `recordSubmission`'s transaction,
// so an entry cannot exist without the grading it came from and the grading
// cannot land without the entry. `rebuildLeaderboard` derives the whole table
// from `participant` rows, and a test asserts the two agree — the arrangement
// E.4 used to make `player_stats` believable, and the answer to the cost the
// owner accepted when this table was chosen over deriving.
import { and, asc, desc, eq, gt, gte, isNotNull, lt, or, sql } from 'drizzle-orm';

import type { Database } from '../client.js';
import { game, participant } from '../schema/game.js';
import { leaderboardEntry } from '../schema/leaderboard.js';
import { profile } from '../schema/profile.js';

type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** One graded participation, as the board needs it. */
export interface EligibleScore {
  readonly participantId: string;
  /** Null for a guest: a board cannot print a name nobody chose. */
  readonly userId: string | null;
  readonly mode: 'solo' | 'multiplayer';
  readonly score: number;
  readonly finishedAt: Date;
}

/**
 * Makes this score eligible to be ranked.
 *
 * `onConflictDoNothing` on the primary key, which is the participation itself:
 * a round is graded once — `recordSubmission` updates `where submitted_at is
 * null` — so a second call for the same participation is a retry rather than a
 * second score, and the first answer stands. Updating instead would let a
 * replayed request overwrite a score with one computed against a later clock.
 *
 * Returns whether a row was written, so the caller can tell a first grading
 * from a retry without asking again.
 */
export async function recordEligibleScore(
  db: Db,
  entry: EligibleScore,
): Promise<boolean> {
  const written = await db
    .insert(leaderboardEntry)
    .values({
      participantId: entry.participantId,
      userId: entry.userId,
      mode: entry.mode,
      score: entry.score,
      finishedAt: entry.finishedAt,
    })
    .onConflictDoNothing({ target: leaderboardEntry.participantId })
    .returning({ participantId: leaderboardEntry.participantId });

  return written.length > 0;
}

/**
 * Rebuilds the table from the rounds it is supposed to describe.
 *
 * **This is what makes the fast path trustworthy**, and it is not a maintenance
 * script: `leaderboard.test.ts` plays rounds through `recordSubmission` and then
 * rebuilds over the same `participant` rows, asserting the two are identical.
 * A drift between the write path and the truth is exactly the cost that was
 * named when this table was chosen over deriving the boards, and this is how it
 * is paid rather than accepted.
 *
 * The definition of eligible lives here, once: a participation with a
 * `submitted_at`. `participant`'s own check ties that to `score`, so there is no
 * second condition to remember and no row this can produce with a null score.
 */
export async function rebuildLeaderboard(db: Db): Promise<number> {
  await db.delete(leaderboardEntry);

  const rows = await db
    .select({
      participantId: participant.id,
      userId: participant.userId,
      mode: game.mode,
      score: participant.score,
      finishedAt: participant.submittedAt,
    })
    .from(participant)
    .innerJoin(game, eq(participant.gameId, game.id))
    .where(and(isNotNull(participant.submittedAt), isNotNull(participant.score)));

  if (rows.length === 0) return 0;

  await db.insert(leaderboardEntry).values(
    rows.map((row) => ({
      participantId: row.participantId,
      userId: row.userId,
      mode: row.mode,
      score: row.score as number,
      finishedAt: row.finishedAt as Date,
    })),
  );

  return rows.length;
}

/** Every entry, oldest first. For the test that holds the two paths together. */
export function selectEligibleScores(db: Db) {
  return db
    .select({
      participantId: leaderboardEntry.participantId,
      userId: leaderboardEntry.userId,
      mode: leaderboardEntry.mode,
      score: leaderboardEntry.score,
      finishedAt: leaderboardEntry.finishedAt,
    })
    .from(leaderboardEntry)
    .orderBy(
      sql`${leaderboardEntry.finishedAt} asc, ${leaderboardEntry.participantId} asc`,
    );
}

/** What a board is asked for — step G.4. */
export interface BoardQuery {
  readonly mode: 'solo' | 'multiplayer';
  /** Null for all of history, which is `boardWindowOf`'s null. */
  readonly window: { readonly fromMs: number; readonly toMs: number } | null;
  /** Null for the world board. */
  readonly region: string | null;
  readonly limit: number;
  /** G.7 — where to start, for the rows around a player's own rank. */
  readonly offset?: number;
}

/** One row of a board. The rank is the row's position, not a stored number. */
export interface BoardRow {
  readonly userId: string;
  readonly displayName: string;
  readonly score: number;
  readonly finishedAt: Date;
  /**
   * H.6 — the frame this player is wearing, or null for the design system's own.
   *
   * On the board's own row rather than fetched per player, because the join to
   * `profile` is already there: a board that read fifty frames separately would
   * be fifty queries for a column the row it already has could carry.
   *
   * Only the frame. A marker draws a player's own marks, and G.5's boards show
   * no marks; a mark style is seen by the player alone. Carrying either here
   * would be a column nothing reads.
   */
  readonly frame: string | null;
}

/**
 * The filters every board read shares — step G.4.
 *
 * One function so that the board, the player count and a player's own rank
 * cannot disagree about which rows they are talking about. G.7 found that they
 * could: three copies of the same three clauses is three places for a period to
 * be windowed differently.
 */
function boardFilters(query: Omit<BoardQuery, 'limit'>) {
  return and(
    eq(leaderboardEntry.mode, query.mode),
    isNotNull(leaderboardEntry.userId),
    ...(query.window === null
      ? []
      : [
          gte(leaderboardEntry.finishedAt, new Date(query.window.fromMs)),
          lt(leaderboardEntry.finishedAt, new Date(query.window.toMs)),
        ]),
    ...(query.region === null ? [] : [eq(profile.effectiveRegion, query.region)]),
  );
}

/**
 * Each player's best round in the period — steps G.4 and G.7.
 *
 * **One row per player, and that was a defect G.7 found in G.5.** The board
 * listed *entries*, so a player with five good rounds took five of the fifty
 * rows — and "your own rank" has no meaning when a player has five of them. The
 * plan asks for "a world ranking" and "your own rank", both singular.
 *
 * `distinct on (user_id)` with the inner order `user_id, score desc, finished_at
 * asc` picks each player's best round, earliest if they tied with themselves.
 * The outer order then ranks those bests.
 *
 * The inner join to `profile` is the filter, and it does three jobs a `where`
 * clause would have to remember: a board shows names and only a profile row has
 * one, so a guest, an account with no pseudonym, and a deleted account whose
 * `user_id` E.7 set to null are all excluded. None has a name to print or a rank
 * to be given.
 */
function bestPerPlayer(db: Db, query: Omit<BoardQuery, 'limit'>) {
  return db
    .selectDistinctOn([leaderboardEntry.userId], {
      userId: profile.userId,
      displayName: profile.displayName,
      score: leaderboardEntry.score,
      finishedAt: leaderboardEntry.finishedAt,
      frame: profile.wornFrame,
    })
    .from(leaderboardEntry)
    .innerJoin(profile, eq(profile.userId, leaderboardEntry.userId))
    .where(boardFilters(query))
    .orderBy(
      asc(leaderboardEntry.userId),
      desc(leaderboardEntry.score),
      asc(leaderboardEntry.finishedAt),
    )
    .as('best');
}

/**
 * The board, ordered — steps G.4 and G.7.
 *
 * **The order is total.** `score desc` is the board; `finished_at asc` breaks a
 * tie in favour of whoever got there first, which is the only tie-break a player
 * would call fair; and `userId` breaks the remaining one so that two calls with
 * the same data return the same order. Without the last, a board would reshuffle
 * its tied rows between page loads.
 *
 * A null window puts no clause on `finished_at` at all, which is G.3's decision
 * and what `leaderboard-volume.test.ts` measures the all-time plan on.
 */
export function boardQuery(db: Db, query: BoardQuery) {
  const best = bestPerPlayer(db, query);

  return db
    .select({
      userId: best.userId,
      displayName: best.displayName,
      score: best.score,
      finishedAt: best.finishedAt,
      frame: best.frame,
    })
    .from(best)
    .orderBy(desc(best.score), asc(best.finishedAt), asc(best.userId))
    .limit(query.limit)
    .offset(query.offset ?? 0);
}

/**
 * How many players a board has — step G.6's threshold reads this.
 *
 * Distinct players and not entries: a board that opens at fifty *scores* opens
 * when one player has played fifty rounds, which is not what "enough players"
 * means to anybody who reads it.
 */
export async function countBoardPlayers(
  db: Db,
  query: Omit<BoardQuery, 'limit'>,
): Promise<number> {
  const [row] = await db
    .select({ players: sql<number>`count(distinct ${leaderboardEntry.userId})::int` })
    .from(leaderboardEntry)
    .innerJoin(profile, eq(profile.userId, leaderboardEntry.userId))
    .where(boardFilters(query));

  return row?.players ?? 0;
}

/** The board, run. `boardQuery` is exported so a test can read its plan. */
export async function selectBoard(
  db: Db,
  query: BoardQuery,
): Promise<readonly BoardRow[]> {
  return boardQuery(db, query);
}

/** A player's own standing on a board — step G.7. */
export interface OwnRank {
  /**
   * Whose standing it is.
   *
   * Echoed back rather than left to the caller to remember, so a screen can mark
   * the viewer's row by comparing one object against the rows it was given. A
   * caller holding the id separately is a caller that can pair the wrong two.
   */
  readonly userId: string;
  readonly rank: number;
  readonly score: number;
  readonly finishedAt: Date;
}

/**
 * Where this player stands on the board, or null if they are not on it.
 *
 * **Competition ranking**: one more than the number of players who did strictly
 * better. Two players tied on a best score share a rank, which is what every
 * scoreboard a player has ever read does and the only reading that does not have
 * to explain itself.
 *
 * Null when the player has no qualifying round in the period — a different thing
 * from a rank of zero. They are not last; they are not on this board, and the
 * screen says so rather than showing a number.
 *
 * The comparison is on the player's **best** round, because that is what the
 * board ranks since G.7, and it goes through `boardFilters` — the same clauses
 * the board itself uses — so the two cannot disagree about which period they
 * mean.
 */
export async function selectOwnRank(
  db: Db,
  query: Omit<BoardQuery, 'limit'>,
  userId: string,
): Promise<OwnRank | null> {
  const mineQuery = bestPerPlayer(db, query);
  const [mine] = await db
    .select({ score: mineQuery.score, finishedAt: mineQuery.finishedAt })
    .from(mineQuery)
    .where(eq(mineQuery.userId, userId));

  if (mine === undefined) return null;

  // Strictly better: a higher best score, or the same one reached earlier —
  // which is the board's own tie-break, so a rank agrees with the row order.
  const others = bestPerPlayer(db, query);
  const [ahead] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(others)
    .where(
      or(
        gt(others.score, mine.score),
        and(eq(others.score, mine.score), lt(others.finishedAt, mine.finishedAt)),
      ),
    );

  return {
    userId,
    rank: (ahead?.count ?? 0) + 1,
    score: mine.score,
    finishedAt: mine.finishedAt,
  };
}

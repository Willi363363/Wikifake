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
import { and, asc, desc, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';

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
}

/** One row of a board. The rank is the row's position, not a stored number. */
export interface BoardRow {
  readonly userId: string;
  readonly displayName: string;
  readonly score: number;
  readonly finishedAt: Date;
}

/**
 * The board, ordered — step G.4.
 *
 * **The inner join to `profile` is the filter**, and it is worth saying because
 * it does three things at once that would otherwise be three `where` clauses. A
 * board shows names, and only a `profile` row has one: so a guest — who holds a
 * `user` row and no profile — is excluded, an account that has not chosen a
 * pseudonym is excluded, and a deleted account, whose `user_id` E.7 set to null,
 * is excluded. None of them has a name to print or a rank to be given.
 *
 * **The order is total.** `score desc` is the board; `finished_at asc` breaks a
 * tie in favour of whoever got there first, which is the only tie-break a player
 * would call fair; and `participant_id` breaks the remaining one so that two
 * calls with the same data return the same order. Without the last, a board
 * would reshuffle its tied rows between page loads.
 *
 * A null window puts no clause on `finished_at` at all, which is G.3's decision
 * and what `leaderboard-volume.test.ts` measures the all-time plan on.
 */
export function boardQuery(db: Db, query: BoardQuery) {
  const conditions = [
    eq(leaderboardEntry.mode, query.mode),
    isNotNull(leaderboardEntry.userId),
    ...(query.window === null
      ? []
      : [
          gte(leaderboardEntry.finishedAt, new Date(query.window.fromMs)),
          lt(leaderboardEntry.finishedAt, new Date(query.window.toMs)),
        ]),
    ...(query.region === null ? [] : [eq(profile.effectiveRegion, query.region)]),
  ];

  return db
    .select({
      userId: profile.userId,
      displayName: profile.displayName,
      score: leaderboardEntry.score,
      finishedAt: leaderboardEntry.finishedAt,
    })
    .from(leaderboardEntry)
    .innerJoin(profile, eq(profile.userId, leaderboardEntry.userId))
    .where(and(...conditions))
    .orderBy(
      desc(leaderboardEntry.score),
      asc(leaderboardEntry.finishedAt),
      asc(leaderboardEntry.participantId),
    )
    .limit(query.limit);
}

/** The board, run. `boardQuery` is exported so a test can read its plan. */
export async function selectBoard(
  db: Db,
  query: BoardQuery,
): Promise<readonly BoardRow[]> {
  return boardQuery(db, query);
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
  const conditions = [
    eq(leaderboardEntry.mode, query.mode),
    isNotNull(leaderboardEntry.userId),
    ...(query.window === null
      ? []
      : [
          gte(leaderboardEntry.finishedAt, new Date(query.window.fromMs)),
          lt(leaderboardEntry.finishedAt, new Date(query.window.toMs)),
        ]),
    ...(query.region === null ? [] : [eq(profile.effectiveRegion, query.region)]),
  ];

  const [row] = await db
    .select({ players: sql<number>`count(distinct ${leaderboardEntry.userId})::int` })
    .from(leaderboardEntry)
    .innerJoin(profile, eq(profile.userId, leaderboardEntry.userId))
    .where(and(...conditions));

  return row?.players ?? 0;
}

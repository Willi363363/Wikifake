// Writing a score down so it can be ranked — step G.2.
//
// Two functions, and the second exists to make the first trustworthy.
//
// `recordEligibleScore` is called from inside `recordSubmission`'s transaction,
// so an entry cannot exist without the grading it came from and the grading
// cannot land without the entry. `rebuildLeaderboard` derives the whole table
// from `participant` rows, and a test asserts the two agree — the arrangement
// E.4 used to make `player_stats` believable, and the answer to the cost the
// owner accepted when this table was chosen over deriving.
import { and, eq, isNotNull, sql } from 'drizzle-orm';

import type { Database } from '../client.js';
import { game, participant } from '../schema/game.js';
import { leaderboardEntry } from '../schema/leaderboard.js';

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

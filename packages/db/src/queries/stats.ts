// The aggregate a profile reads — step E.4.
//
// Two ways in, and they have to agree.
//
// - **Incrementally**, on the two moments that change anything: a round joined
//   and a round finished. This is the hot path and it is the one the plan asks
//   for — a profile must never `group by` a player's whole history to draw one
//   screen.
// - **By recomputation**, from the `participant` rows themselves. Rare, and for
//   the one case the increments cannot express: `attachGuestRecords` moves a
//   guest's finished games onto a real account *after* they were counted
//   against an anonymous one, and merging two aggregates is not addition —
//   `bestStreak` is a maximum over an ordering, and two orderings do not
//   concatenate.
//
// `stats.test.ts` plays a sequence through the increments and then recomputes
// over the same rows, and asserts the two produce the identical row. That
// equality is the whole design: the fast path is only trustworthy because the
// slow one exists to check it.
//
// **What feeds it today is solo.** Multiplayer creates `game` and `participant`
// rows with a nickname and no `userId`, and never records a submission in
// Postgres at all — the round lives in Redis and the scores are broadcast. So
// these counters are correct and incomplete, and the step that closes that is
// E.3b in `plans/product/05-accounts.md`. Nothing here needs changing when it
// lands: the increments hang off `createGame` and `recordSubmission`, so the
// day multiplayer goes through them the numbers follow.
import { asc, eq, isNotNull, sql } from 'drizzle-orm';

import type { Database } from '../client.js';
import { game, participant } from '../schema/game.js';
import { playerStats } from '../schema/stats.js';

/**
 * A connection **or** a transaction.
 *
 * The two increments below are called from inside `createGame`'s and
 * `recordSubmission`'s transactions, and drizzle's transaction handle is not a
 * `PostgresJsDatabase` — it has no `$client`. Typing them to the connection
 * would have forced the calls outside the transaction, which is exactly the
 * arrangement this file exists to avoid: a submission that landed and a
 * statistic that did not.
 *
 * Derived from the connection's own `transaction` signature rather than named
 * from drizzle's internals, so it follows the version rather than pinning one.
 */
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** What a profile is handed: the stored columns, plus what they imply. */
export interface PlayerStats {
  readonly gamesPlayed: number;
  readonly gamesFinished: number;
  /** Started and never submitted. Derived: a stored column could disagree. */
  readonly gamesAbandoned: number;
  readonly falsificationsFound: number;
  readonly falsificationsMissed: number;
  readonly paragraphsWronglyMarked: number;
  readonly bestScore: number | null;
  /** Null until a round is finished — no score is not a score of zero. */
  readonly averageScore: number | null;
  /**
   * Found over found plus missed, as a ratio. Null before there is anything to
   * divide.
   *
   * Derived here rather than stored, like `gamesAbandoned` and `averageScore`:
   * `05-accounts.md` names all three as things a column could disagree with its
   * own inputs about. Paragraphs wrongly marked are deliberately not in the
   * denominator — this answers "of the falsifications that were there, how many
   * did they see", and a player who marks nothing extra is not more accurate
   * for it. What false positives cost is the score, and C2.1 already says so.
   */
  readonly accuracy: number | null;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly firstSeen: Date;
  readonly lastSeen: Date;
}

/** One finished round, in the terms the aggregate counts. */
export interface FinishedRound {
  readonly userId: string;
  readonly score: number;
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly totalFakes: number;
  readonly at: Date;
  /**
   * Whether this round keeps a streak alive.
   *
   * **A boolean rather than a rule, and that is the architecture rather than a
   * preference.** `workspace-graph.test.ts` keeps `db` away from `@wikifake/
   * domain` in as many words — *data does not depend on rules* — so
   * `isPerfectRound` is evaluated by whoever grades the round and this column
   * stores what they decided. The first version of this file imported the
   * predicate, and that test is what said no.
   */
  readonly perfect: boolean;
}

/**
 * The streak rule, passed in.
 *
 * `recomputePlayerStats` replays a history and has to ask the question again
 * per round, which a stored boolean cannot answer for rows written before the
 * rule existed. So the caller — which is allowed to know the rules — hands the
 * predicate down. `@wikifake/domain`'s `isPerfectRound` is what goes here.
 */
export type PerfectRound = (round: {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly totalFakes: number;
}) => boolean;

/**
 * Counts a round as joined, for every player who has an account behind them.
 *
 * At the *start*, not at the end, and that is what makes "abandoned" a number
 * at all: counted only on submission, played and finished would be the same
 * column twice.
 *
 * An upsert, so no row has to be created with the account. A player who never
 * plays has no stats row, which is the right amount of storage for what they
 * have done.
 */
export async function recordRoundsJoined(
  db: Db,
  userIds: readonly string[],
  at: Date,
): Promise<void> {
  const players = [...new Set(userIds)];
  if (players.length === 0) return;

  await db
    .insert(playerStats)
    .values(
      players.map((userId) => ({
        userId,
        gamesPlayed: 1,
        firstSeen: at,
        lastSeen: at,
      })),
    )
    .onConflictDoUpdate({
      target: playerStats.userId,
      set: {
        gamesPlayed: sql`${playerStats.gamesPlayed} + 1`,
        lastSeen: at,
      },
    });
}

/**
 * Counts a round as finished.
 *
 * `greatest` for the best score rather than a read-then-write: two rounds
 * settling at once would otherwise each read the old maximum and the higher one
 * could lose. Postgres does the comparison inside the same statement, and
 * `coalesce` is what makes a first score win against a null rather than
 * disappear into one.
 *
 * The streak is the one figure that cannot be expressed as a column operation:
 * a perfect round adds one and anything else resets to zero, so it is written
 * as a `case`. `bestStreak` then takes the maximum of itself and whatever the
 * current one just became — computed from the same expression rather than from
 * a second read of a value this statement is changing.
 */
export async function recordRoundFinished(db: Db, round: FinishedRound): Promise<void> {
  const perfect = round.perfect;
  const missed = Math.max(0, round.totalFakes - round.truePositives);
  const streak = perfect ? sql`${playerStats.currentStreak} + 1` : sql`0`;

  await db
    .insert(playerStats)
    .values({
      userId: round.userId,
      // A round can only be finished by somebody who joined it, but the insert
      // half of an upsert has to describe a whole row — and a stats row created
      // here rather than at the start would be one game behind for ever.
      gamesPlayed: 1,
      gamesFinished: 1,
      falsificationsFound: round.truePositives,
      falsificationsMissed: missed,
      paragraphsWronglyMarked: round.falsePositives,
      bestScore: round.score,
      totalScore: round.score,
      currentStreak: perfect ? 1 : 0,
      bestStreak: perfect ? 1 : 0,
      firstSeen: round.at,
      lastSeen: round.at,
    })
    .onConflictDoUpdate({
      target: playerStats.userId,
      set: {
        gamesFinished: sql`${playerStats.gamesFinished} + 1`,
        falsificationsFound: sql`${playerStats.falsificationsFound} + ${round.truePositives}`,
        falsificationsMissed: sql`${playerStats.falsificationsMissed} + ${missed}`,
        paragraphsWronglyMarked: sql`${playerStats.paragraphsWronglyMarked} + ${round.falsePositives}`,
        bestScore: sql`greatest(coalesce(${playerStats.bestScore}, ${round.score}), ${round.score})`,
        totalScore: sql`${playerStats.totalScore} + ${round.score}`,
        currentStreak: streak,
        bestStreak: sql`greatest(${playerStats.bestStreak}, ${streak})`,
        lastSeen: round.at,
      },
    });
}

/** Found over what there was to find, or null before there was anything. */
function accuracyOf(found: number, missed: number): number | null {
  const total = found + missed;
  return total === 0 ? null : found / total;
}

/** The row a profile draws, or null for a player who has never joined a round. */
export async function selectPlayerStats(
  db: Db,
  userId: string,
): Promise<PlayerStats | null> {
  const [row] = await db
    .select()
    .from(playerStats)
    .where(eq(playerStats.userId, userId))
    .limit(1);

  if (row === undefined) return null;

  return {
    gamesPlayed: row.gamesPlayed,
    gamesFinished: row.gamesFinished,
    gamesAbandoned: Math.max(0, row.gamesPlayed - row.gamesFinished),
    falsificationsFound: row.falsificationsFound,
    falsificationsMissed: row.falsificationsMissed,
    paragraphsWronglyMarked: row.paragraphsWronglyMarked,
    bestScore: row.bestScore,
    // Rounded to the point, because a profile shows a number and not a float:
    // the average of 150 and 155 is a score nobody scored either way.
    averageScore:
      row.gamesFinished === 0 ? null : Math.round(row.totalScore / row.gamesFinished),
    accuracy: accuracyOf(row.falsificationsFound, row.falsificationsMissed),
    currentStreak: row.currentStreak,
    bestStreak: row.bestStreak,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
  };
}

/**
 * Rebuilds one player's row from the rounds themselves.
 *
 * For `attachGuestRecords`, and for nothing on a page load. Two aggregates
 * cannot be added: `bestStreak` is a maximum over an ordering, and the guest's
 * ordering and the account's interleave rather than concatenate. Recomputing is
 * the only answer that is right, and the moment it is needed — an account being
 * created — is the moment it is cheapest.
 *
 * Ordered by submission time, because that is what a streak is a sequence of.
 * Rounds still in flight are skipped rather than counted as failures: an
 * unfinished round has no outcome yet, and treating it as one would break a
 * streak the player has not lost.
 */
export async function recomputePlayerStats(
  db: Db,
  userId: string,
  isPerfect: PerfectRound,
): Promise<void> {
  const rows = await db
    .select({
      score: participant.score,
      truePositives: participant.truePositives,
      falsePositives: participant.falsePositives,
      submittedAt: participant.submittedAt,
      startedAt: game.startedAt,
      totalFakes: game.totalFakes,
    })
    .from(participant)
    .innerJoin(game, eq(participant.gameId, game.id))
    .where(eq(participant.userId, userId))
    .orderBy(asc(game.startedAt));

  if (rows.length === 0) {
    await db.delete(playerStats).where(eq(playerStats.userId, userId));
    return;
  }

  const finished = rows
    .filter((row) => row.submittedAt !== null)
    .sort(
      (a, b) => (a.submittedAt as Date).getTime() - (b.submittedAt as Date).getTime(),
    );

  let currentStreak = 0;
  let bestStreak = 0;
  const totals = {
    found: 0,
    missed: 0,
    wrong: 0,
    score: 0,
    best: null as number | null,
  };

  for (const row of finished) {
    const truePositives = row.truePositives ?? 0;
    const falsePositives = row.falsePositives ?? 0;
    const score = row.score ?? 0;

    totals.found += truePositives;
    totals.missed += Math.max(0, row.totalFakes - truePositives);
    totals.wrong += falsePositives;
    totals.score += score;
    totals.best = totals.best === null ? score : Math.max(totals.best, score);

    currentStreak = isPerfect({
      truePositives,
      falsePositives,
      totalFakes: row.totalFakes,
    })
      ? currentStreak + 1
      : 0;
    bestStreak = Math.max(bestStreak, currentStreak);
  }

  // `firstSeen` is when the earliest round was joined, and `lastSeen` the
  // latest thing that happened — which is a submission if there is one and the
  // start of an abandoned round otherwise.
  const started = rows.map((row) => row.startedAt.getTime());
  const touched = [
    ...started,
    ...finished.map((row) => (row.submittedAt as Date).getTime()),
  ];

  await db
    .insert(playerStats)
    .values({
      userId,
      gamesPlayed: rows.length,
      gamesFinished: finished.length,
      falsificationsFound: totals.found,
      falsificationsMissed: totals.missed,
      paragraphsWronglyMarked: totals.wrong,
      bestScore: totals.best,
      totalScore: totals.score,
      currentStreak,
      bestStreak,
      firstSeen: new Date(Math.min(...started)),
      lastSeen: new Date(Math.max(...touched)),
    })
    .onConflictDoUpdate({
      target: playerStats.userId,
      set: {
        gamesPlayed: rows.length,
        gamesFinished: finished.length,
        falsificationsFound: totals.found,
        falsificationsMissed: totals.missed,
        paragraphsWronglyMarked: totals.wrong,
        bestScore: totals.best,
        totalScore: totals.score,
        currentStreak,
        bestStreak,
        firstSeen: new Date(Math.min(...started)),
        lastSeen: new Date(Math.max(...touched)),
      },
    });
}

/**
 * Every account with a stats row, for the tests that hold the two paths
 * together and for track I's panel.
 */
export function selectPlayersWithStats(db: Db) {
  return db
    .select({ userId: playerStats.userId })
    .from(playerStats)
    .where(isNotNull(playerStats.userId));
}

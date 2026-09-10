// Writing a quest set down, reading it back, and the rounds it is measured
// against — steps F.3 and F.4.
//
// Three functions, and the first one's whole job is to be safe to call twice. F.5
// will call it from a cron and F.4's read path will call it for a player whose
// set was never generated — a new account, a missed run, an outage — so "assign
// this set" has to mean *make sure this set exists* rather than *insert these
// rows*.
//
// **The row shape is declared here rather than imported.** `db` may not depend
// on `@wikifake/domain`, which is where `QuestAssignment` lives, and
// `workspace-graph.test.ts` enforces it: data does not depend on rules. So the
// caller — which may depend on both — maps one onto the other, exactly as
// `recordSubmission` is handed `isPerfectRound` instead of reaching for it.
import { and, asc, eq, gte, isNotNull, lt } from 'drizzle-orm';

import type { Database } from '../client.js';
import { game, participant } from '../schema/game.js';
import { questAssignment } from '../schema/quests.js';

/** A connection or a transaction, like every other query module here. */
type Tx = Parameters<Parameters<Database['db']['transaction']>[0]>[0];
type Db = Database['db'] | Tx;

/** The two periods, spelled here because the enum is not importable as data. */
export type QuestPeriodName = 'daily' | 'weekly';

/** One quest to write down: what the generator drew, without the rules. */
export interface QuestToAssign {
  readonly ruleId: string;
  readonly period: QuestPeriodName;
  readonly periodIndex: number;
  readonly target: number;
}

/** A quest as it comes back out, with the two states F.6 will care about. */
export interface AssignedQuest extends QuestToAssign {
  readonly id: string;
  readonly assignedAt: Date;
  /** Null while the reward is still there to take. */
  readonly claimedAt: Date | null;
}

/**
 * Makes sure this player has exactly these quests for the period.
 *
 * **Idempotent by constraint, not by check.** `onConflictDoNothing` against
 * `quest_assignment_key` is what makes a second call write nothing: a
 * read-then-insert would have two crons — or a cron and a read path — both see
 * *absent* and both insert. The unique index answers once, under a lock neither
 * process can see around.
 *
 * It deliberately does **not** update on conflict. A row that already exists is
 * a promise already made, and a target that changed underneath a player who has
 * half finished it is the one outcome the stored target exists to prevent. So a
 * catalogue edit reaches tomorrow's set and leaves today's alone.
 *
 * Nothing is deleted either: a quest this call does not mention but that is
 * already in the table stays. That case only arises from a catalogue change
 * mid-period, and dropping a row a player may have finished is worse than
 * leaving them one quest more than the set says.
 *
 * Returns how many rows were new, which is what makes the idempotence visible
 * to a caller — and to F.5's log, where "assigned 0" on a second run is the
 * evidence rather than a claim.
 */
export async function assignQuests(
  db: Db,
  userId: string,
  quests: readonly QuestToAssign[],
): Promise<number> {
  if (quests.length === 0) return 0;

  const written = await db
    .insert(questAssignment)
    .values(
      quests.map((quest) => ({
        userId,
        period: quest.period,
        periodIndex: quest.periodIndex,
        ruleId: quest.ruleId,
        target: quest.target,
      })),
    )
    .onConflictDoNothing({
      target: [
        questAssignment.userId,
        questAssignment.period,
        questAssignment.periodIndex,
        questAssignment.ruleId,
      ],
    })
    .returning({ id: questAssignment.id });

  return written.length;
}

/**
 * The quests this player holds for one day, or one week.
 *
 * Ordered by `ruleId` rather than by insertion, so a screen renders the same
 * list in the same order on every load. The generator's shuffle decides *which*
 * rules a set holds; it has no opinion about the order they are read in, and
 * leaving it to Postgres would mean a list that reshuffles itself after a
 * vacuum.
 */
export async function selectQuestSet(
  db: Db,
  userId: string,
  period: QuestPeriodName,
  periodIndex: number,
): Promise<readonly AssignedQuest[]> {
  const rows = await db
    .select({
      id: questAssignment.id,
      ruleId: questAssignment.ruleId,
      period: questAssignment.period,
      periodIndex: questAssignment.periodIndex,
      target: questAssignment.target,
      assignedAt: questAssignment.assignedAt,
      claimedAt: questAssignment.claimedAt,
    })
    .from(questAssignment)
    .where(
      and(
        eq(questAssignment.userId, userId),
        eq(questAssignment.period, period),
        eq(questAssignment.periodIndex, periodIndex),
      ),
    )
    .orderBy(asc(questAssignment.ruleId));

  return rows;
}

/**
 * A finished round, with the columns a quest tally or qualifier reads — F.4.
 *
 * The shape is the whole of the boundary. **This module counts nothing**: it
 * does not know what a perfect round is, what a hint costs or which rounds a
 * rule wants, because `db` may not import `@wikifake/domain` and those are its
 * rules. It hands back rows; `progressFor` over there decides what they add up
 * to. A `where` clause spelling out `true_positives = total_fakes and
 * false_positives = 0` would have been a second definition of perfect, in the
 * package that is forbidden the first one.
 */
export interface RoundInWindow {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly totalFakes: number;
  readonly hintsUsed: number;
  readonly score: number;
  readonly mode: 'solo' | 'multiplayer';
  readonly at: Date;
}

/**
 * This player's finished rounds inside a half-open window.
 *
 * **Windowed on `submitted_at`, so a round counts for the period it was
 * *finished* in.** A round begun at 23:50 and submitted at 00:05 belongs to the
 * new day, and that is the only defensible reading: its numbers do not exist
 * until it is graded, and `started_at` would let a player hold a round open
 * across a boundary to choose which day it counted for.
 *
 * Unsubmitted rounds are excluded twice over — `is not null` on `submitted_at`,
 * and the range on the same column — which is deliberate belt and braces: the
 * schema's own check ties `submitted_at` and `score` together, so a row inside
 * the window always has the figures below, and none of them needs a fallback.
 */
export async function selectRoundsInWindow(
  db: Db,
  userId: string,
  fromMs: number,
  toMs: number,
): Promise<readonly RoundInWindow[]> {
  const rows = await db
    .select({
      truePositives: participant.truePositives,
      falsePositives: participant.falsePositives,
      totalFakes: game.totalFakes,
      hintsUsed: participant.hintsUsed,
      score: participant.score,
      mode: game.mode,
      at: participant.submittedAt,
    })
    .from(participant)
    .innerJoin(game, eq(participant.gameId, game.id))
    .where(
      and(
        eq(participant.userId, userId),
        isNotNull(participant.submittedAt),
        gte(participant.submittedAt, new Date(fromMs)),
        lt(participant.submittedAt, new Date(toMs)),
      ),
    )
    .orderBy(asc(participant.submittedAt));

  // The nullable columns are non-null for a submitted round — the
  // `participant_score_with_submission` check says so — and this is where that
  // guarantee is turned into a type rather than into a `?? 0` per field, which
  // would silently count a broken row as a played one.
  return rows.map((row) => ({
    truePositives: row.truePositives ?? 0,
    falsePositives: row.falsePositives ?? 0,
    totalFakes: row.totalFakes,
    hintsUsed: row.hintsUsed ?? 0,
    score: row.score ?? 0,
    mode: row.mode,
    at: row.at as Date,
  }));
}

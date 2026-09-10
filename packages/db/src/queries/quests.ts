// Writing a quest set down, and reading it back — step F.3.
//
// Two functions, and the first one's whole job is to be safe to call twice. F.5
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
import { and, asc, eq } from 'drizzle-orm';

import type { Database } from '../client.js';
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

// The quests a player holds right now — step F.5's guarantee.
//
// **The cron is an optimisation; this is the guarantee**, in the track's own
// words. A set that was never generated — a new account, a missed run, an
// outage, a player created at 03:00 — is generated here, on the request that
// asks for it. So the exit gate "a player created at 03:00 sees quests
// immediately" is not something the schedule has to get right.
//
// This is also the layer that may hold both halves at once. `@wikifake/db` may
// not import `@wikifake/domain` — data does not depend on rules — so the
// mapping between a generated assignment and a row lives here, in the
// application, exactly as `attachGuestRecords` is handed `isPerfectRound`.
import {
  assignQuests,
  selectQuestSet,
  selectRoundsInWindow,
  type AssignedQuest,
  type Database,
} from '@wikifake/db';
import {
  generateQuestSet,
  isQuestComplete,
  periodIndexOf,
  periodWindowOf,
  progressFor,
  QUEST_CATALOGUE,
  type QuestPeriod,
  type QuestRule,
  type QuestRuleId,
} from '@wikifake/domain';

export interface QuestsContext {
  readonly db: Database['db'];
}

/** A quest as a screen needs it: the promise, the progress, and the reward. */
export interface LiveQuest {
  readonly ruleId: QuestRuleId;
  readonly period: QuestPeriod;
  readonly periodIndex: number;
  readonly target: number;
  readonly progress: number;
  readonly complete: boolean;
  /** Read from the catalogue, never from the row — F.3's asymmetry. */
  readonly reward: number;
  /** Null while the reward is still there to take. F.6 sets it. */
  readonly claimedAt: Date | null;
}

/**
 * The rule a row names, or null when the catalogue no longer knows it.
 *
 * F.3 stores `rule_id` as text precisely so a retired rule's rows survive, and
 * this is the tolerance that costs: a row naming a rule that has been removed
 * cannot be shown — there is no label for it, no tally to count and no reward to
 * pay — so it is dropped from the list rather than rendered as a blank.
 */
function ruleFor(ruleId: string): QuestRule | null {
  return QUEST_CATALOGUE[ruleId as QuestRuleId] ?? null;
}

/**
 * The rows for one period, generating them if there are none.
 *
 * **It re-reads after writing rather than returning what it generated**, and
 * that is the point rather than a formality: two requests can arrive together,
 * or the cron can be running, and `assignQuests` deliberately does not update on
 * conflict — so the rows are the promise and the generated list is only a
 * proposal. Trusting the proposal would show a player a target that is not the
 * one stored against their name.
 */
async function rowsFor(
  context: QuestsContext,
  userId: string,
  period: QuestPeriod,
  periodIndex: number,
): Promise<readonly AssignedQuest[]> {
  const existing = await selectQuestSet(context.db, userId, period, periodIndex);
  if (existing.length > 0) return existing;

  await assignQuests(
    context.db,
    userId,
    generateQuestSet(userId, period, periodIndex).map((quest) => ({
      ruleId: quest.ruleId,
      period: quest.period,
      periodIndex: quest.periodIndex,
      target: quest.target,
    })),
  );

  return selectQuestSet(context.db, userId, period, periodIndex);
}

/**
 * One period's quests, with how far this player has got in each.
 *
 * The rounds are fetched once for the period and counted per rule, because
 * every rule in a set shares the window — the qualifier is what differs, and
 * that is applied in memory by `progressFor`.
 */
async function periodQuests(
  context: QuestsContext,
  userId: string,
  period: QuestPeriod,
  atMs: number,
): Promise<readonly LiveQuest[]> {
  const periodIndex = periodIndexOf(period, atMs);
  const rows = await rowsFor(context, userId, period, periodIndex);
  if (rows.length === 0) return [];

  const window = periodWindowOf(period, periodIndex);
  const rounds = await selectRoundsInWindow(
    context.db,
    userId,
    window.fromMs,
    window.toMs,
  );

  return rows.flatMap((row) => {
    const rule = ruleFor(row.ruleId);
    if (rule === null) return [];

    const progress = progressFor(rule, rounds);
    return [
      {
        ruleId: rule.id,
        period,
        periodIndex: row.periodIndex,
        target: row.target,
        progress,
        complete: isQuestComplete(row.target, progress),
        reward: rule.reward,
        claimedAt: row.claimedAt,
      },
    ];
  });
}

/**
 * Everything this player has to do today and this week.
 *
 * Two periods, two windows, and **two round queries rather than one wide one
 * filtered twice.** A week contains its days, so the weekly rows could have
 * been narrowed in memory — but the narrowing is the period boundary, and
 * `periodWindowOf` is the only place that rule is allowed to live. Two indexed
 * reads cost less than a second copy of a boundary that could be wrong.
 *
 * `atMs` is a parameter, like every clock in this repository: the cron passes
 * the instant it ran at, a screen passes now, and a test passes a Thursday.
 */
export async function readLiveQuests(
  context: QuestsContext,
  userId: string,
  atMs: number,
): Promise<readonly LiveQuest[]> {
  const [daily, weekly] = await Promise.all([
    periodQuests(context, userId, 'daily', atMs),
    periodQuests(context, userId, 'weekly', atMs),
  ]);

  return [...daily, ...weekly];
}

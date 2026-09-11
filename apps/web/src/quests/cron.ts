// The quest cron — step F.5.
//
// **It assigns nothing that the read path could not assign on demand.** That is
// worth stating first, because it is what the whole design rests on: `sets.ts`
// generates a missing set for whoever asks, so this run is a pre-warm and never
// a prerequisite. Stop the cron for a week and every player still has quests;
// what they lose is nothing they can see.
//
// So the two properties the plan demands are both free. **Idempotent**, because
// `generateQuestSet` is deterministic and `assignQuests` writes nothing on
// conflict — running twice for the same day changes nothing, and the second run
// says `assigned: 0`. **Self-healing**, because the guarantee was never here.
import { assignQuests, selectPlayersActiveSince, type Database } from '@wikifake/db';
import { generateQuestSet, periodIndexOf, type QuestPeriod } from '@wikifake/domain';

export interface CronContext {
  readonly db: Database['db'];
}

/**
 * How far back the cron bothers to look.
 *
 * Fourteen days, and the number matters less than the reason there is one. The
 * read path covers everybody, so pre-generating a set for a player who has not
 * touched the game in months writes five rows a day, for ever, that nobody will
 * ever read. A returning player is not left out: they get their set on the
 * request that brings them back.
 */
export const CRON_ACTIVE_DAYS = 14;

const PERIODS: readonly QuestPeriod[] = ['daily', 'weekly'];

export interface CronOutcome {
  /** How many players were considered. */
  readonly players: number;
  /** How many rows were new. `0` on a second run for the same day. */
  readonly assigned: number;
}

/**
 * Gives every recently active player their sets for the day and the week.
 *
 * **One run covers both periods**, which is `assignQuests` being idempotent
 * rather than a coincidence: a daily schedule re-offers the weekly set every
 * day, six of those seven writes are conflicts, and the seventh — the Monday —
 * is the one that lands. A second schedule for the weekly set would be a second
 * thing to get wrong for a write that costs nothing.
 *
 * Players are handled one at a time and a failure is not swallowed: one bad row
 * stops the run, the schedule retries tomorrow, and the read path has been
 * covering everybody the whole time. Swallowing errors here would turn a broken
 * cron into a silent one.
 */
export async function assignQuestsForActivePlayers(
  context: CronContext,
  atMs: number,
  activeDays: number = CRON_ACTIVE_DAYS,
): Promise<CronOutcome> {
  const since = new Date(atMs - activeDays * 86_400_000);
  const players = await selectPlayersActiveSince(context.db, since);

  let assigned = 0;
  for (const player of players) {
    for (const period of PERIODS) {
      const periodIndex = periodIndexOf(period, atMs);
      assigned += await assignQuests(
        context.db,
        player.userId,
        generateQuestSet(player.userId, period, periodIndex).map((quest) => ({
          ruleId: quest.ruleId,
          period: quest.period,
          periodIndex: quest.periodIndex,
          target: quest.target,
        })),
      );
    }
  }

  return { players: players.length, assigned };
}

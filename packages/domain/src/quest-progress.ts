// How far a player has got — step F.4.
//
// **The progress reader is here and not in SQL**, and that reverses a reason F.1
// wrote down. F.1 said the qualifier is data "so F.4 can turn it into a `where`
// clause", and the first half is still right for the wrong reason: the catalogue
// has to be data because it is stored, sent to a browser and keyed by, not
// because a query interprets it.
//
// Interpreting it in SQL would mean writing `true_positives = total_fakes and
// false_positives = 0` into a query — a second definition of a perfect round,
// beside `isPerfectRound`, in a package that *may not import it*. E.4 already
// refused that trade once: `recordSubmission` is handed the predicate rather
// than reaching for it, precisely so the rule has one home. A `where` clause
// would have quietly given it two.
//
// What it costs is reading a period's rounds instead of one aggregate row, and
// the window is what makes that free: a day is a handful of rounds and a week is
// a few dozen. F.1's worry — "walk every round a player has ever played" — was
// about an unwindowed query, and there is no unwindowed query here.
import { isPerfectRound } from './scoring.js';
import type { QuestQualifier, QuestRule } from './quests.js';

const MS_PER_DAY = 86_400_000;

/** Half-open: `fromMs` counts, `toMs` is the next period's first instant. */
export interface PeriodWindow {
  readonly fromMs: number;
  readonly toMs: number;
}

/**
 * The instants a period covers — `periodIndexOf` run backwards.
 *
 * Half-open on purpose. A closed window has to name its last instant, and
 * whichever one it names is either a millisecond short or one long: the two
 * periods would share a boundary and a round submitted exactly on it would count
 * twice. `from <= at < to` cannot do that.
 *
 * A week's first day is `index * 7 - 3`, which is `periodIndexOf`'s `+ 3`
 * undone: epoch day 0 was a Thursday, so week 0 began three days before it.
 */
export function periodWindowOf(
  period: QuestRule['period'],
  periodIndex: number,
): PeriodWindow {
  const firstDay = period === 'daily' ? periodIndex : periodIndex * 7 - 3;
  const days = period === 'daily' ? 1 : 7;

  return {
    fromMs: firstDay * MS_PER_DAY,
    toMs: (firstDay + days) * MS_PER_DAY,
  };
}

/**
 * A finished round, as counting needs it.
 *
 * Every field is a column `participant` or its `game` already carries — F.1's
 * constraint, and this interface is where it is cashed in. There is deliberately
 * no `at`: the window has already been applied by whoever fetched these, and a
 * reader that filtered again would be a second place for the boundary rule to be
 * wrong.
 */
export interface CountableRound {
  readonly truePositives: number;
  readonly falsePositives: number;
  readonly totalFakes: number;
  readonly hintsUsed: number;
  readonly score: number;
  readonly mode: 'solo' | 'multiplayer';
}

/** Whether a round counts towards a rule carrying this qualifier. */
export function qualifies(qualifier: QuestQualifier, round: CountableRound): boolean {
  switch (qualifier) {
    case 'any':
      return true;
    // The one definition of perfect, asked rather than restated. Changing what a
    // perfect round is remains one function and a recomputation.
    case 'perfect':
      return isPerfectRound(round);
    case 'noHints':
      return round.hintsUsed === 0;
    case 'nothingWronglyMarked':
      return round.falsePositives === 0;
    case 'multiplayer':
      return round.mode === 'multiplayer';
  }
}

/**
 * What this rule has accumulated over these rounds.
 *
 * `points` sums each qualifying round's score **floored at zero**, which F.1
 * decided and this implements. C2.3 lets a score be negative, so an unfloored
 * sum would give a player a quest whose progress goes *down* after a bad round —
 * and progress that retreats reads as a defect on the one screen whose job is to
 * make coming back tomorrow feel worthwhile.
 *
 * Nothing is capped at the target. A player who finished five rounds towards a
 * quest asking three has done five, and a screen that wants "3 / 3" can hold the
 * minimum itself — whereas a reader that capped could never tell a quest that is
 * just complete from one that was overshot, which is what F.6 needs to know
 * about a claim arriving late.
 */
export function progressFor(rule: QuestRule, rounds: readonly CountableRound[]): number {
  const counted = rounds.filter((round) => qualifies(rule.qualifier, round));

  switch (rule.tally) {
    case 'rounds':
      return counted.length;
    case 'falsificationsFound':
      return counted.reduce((total, round) => total + round.truePositives, 0);
    case 'points':
      return counted.reduce((total, round) => total + Math.max(0, round.score), 0);
  }
}

/** Whether a target has been met. One place, so a screen and F.6 agree. */
export function isQuestComplete(target: number, progress: number): boolean {
  return progress >= target;
}

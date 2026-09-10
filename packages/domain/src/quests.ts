// The quest catalogue — step F.1.
//
// Beside the scoring scale and the item catalogue, and for the same reason: a
// business rule that must exist in exactly one place. A quest carries **no
// content**. Track F's constraint is the owner's, in their words — *once the app
// is launched I want nothing left to do* — so a quest is a rule applied to
// numbers the game already records, and the catalogue below is written once and
// generated from for ever.
//
// Names and descriptions are not here. They are interface text, they belong in
// the i18n catalogue keyed by these identifiers, and a rule carrying a sentence
// is a rule nobody can translate — the same argument `items.ts` makes.
//
// **Everything a rule counts is a column a finished round already carries.**
// That is the constraint that made this file short, and it was checked against
// the schema rather than assumed: `participant` holds `submitted_at`, `score`,
// `true_positives`, `false_positives` and `hints_used`, and its `game` holds
// `mode` and `total_fakes`. A rule that counted anything else would be a
// promise F.4 could not keep.
//
// Two things the schema cannot answer, so that a later step starts from a
// decision rather than a discovery. **Items used are not recorded** —
// `participant.score_stolen` is what was done *to* a player, not what they
// cast — so "use three items" is not a rule this catalogue may express until a
// round writes down what was cast. And **a streak has no time dimension**:
// `player_stats` holds the current and best streak as running totals with no
// date on them, so "a streak of three today" is not answerable either.

/** The two periods a set is drawn for. Monthly only if it is free — track F. */
export type QuestPeriod = 'daily' | 'weekly';

/**
 * What accumulates towards the target.
 *
 * `points` is **the sum of each qualifying round's score, floored at zero per
 * round**, and that is a rule rather than a detail. C2.3 lets a score be
 * negative and does not clamp it — `player_stats.total_score` says so in as
 * many words — so an unfloored sum would give a player a quest whose progress
 * goes *down* when they play badly. Progress that can retreat is worse than no
 * progress: it reads as a bug on the one screen whose job is to make coming
 * back tomorrow feel worthwhile. F.4 implements the floor; it does not choose
 * it.
 */
export type QuestTally = 'rounds' | 'falsificationsFound' | 'points';

/**
 * Which finished rounds count towards a rule.
 *
 * **Data rather than a predicate**, deliberately. `queries/stats.ts` had to be
 * handed `isPerfectRound` as an argument for exactly this reason: *data does not
 * depend on rules*, so `@wikifake/db` may not import this package — and a
 * qualifier expressed as a function is a qualifier F.4 cannot turn into a `where`
 * clause. A closed set of names it can switch on is what keeps the accumulation
 * one query instead of a walk over every round a player has played.
 *
 * `perfect` is `isPerfectRound`'s rule and must stay it: every falsification
 * found and nothing true marked. It is named here and implemented once.
 *
 * **There is no `solo`**, though it is the obvious counterpart to
 * `multiplayer`. No rule needs it: every daily below is completable alone
 * already, so a `solo` qualifier would be a member F.4 has to implement, a test
 * has to cover and nothing has to count. It arrives with the rule that wants it.
 */
export type QuestQualifier =
  'any' | 'perfect' | 'noHints' | 'nothingWronglyMarked' | 'multiplayer';

/**
 * The identifiers, and the contract for everything downstream.
 *
 * **In `domain` rather than in `protocol`, for now.** `protocol` holds the
 * identifiers that cross the wire — that is what `items.ts` means by "the
 * identifiers themselves are the contract" — and no quest crosses it yet. They
 * belong in `protocol` at the step that first sends one to a browser, which is
 * F.7, and the move is a re-export rather than a rename because nothing outside
 * this package reads them until then.
 *
 * **The period is in the name as well as in the field.** The same idea at two
 * periods is two rules and not one: they need different targets and different
 * rewards, and a single rule with a period-keyed target table would be one
 * structure hiding two. Spelling the period into the identifier is also what
 * lets a screen key its copy without composing a string.
 */
export const QUEST_RULE_IDS = [
  'DAILY_FINISH_ROUNDS',
  'DAILY_FIND_FALSIFICATIONS',
  'DAILY_SCORE_POINTS',
  'DAILY_UNAIDED_ROUND',
  'DAILY_NOTHING_WRONGLY_MARKED',
  'WEEKLY_FINISH_ROUNDS',
  'WEEKLY_FIND_FALSIFICATIONS',
  'WEEKLY_SCORE_POINTS',
  'WEEKLY_PERFECT_ROUNDS',
  'WEEKLY_MULTIPLAYER_ROUNDS',
] as const;

export type QuestRuleId = (typeof QUEST_RULE_IDS)[number];

/** A target range, inclusive at both ends. The generator of F.2 draws from it. */
export interface QuestTarget {
  readonly min: number;
  readonly max: number;
}

export interface QuestRule {
  readonly id: QuestRuleId;
  readonly period: QuestPeriod;
  readonly tally: QuestTally;
  readonly qualifier: QuestQualifier;
  /**
   * The range a drawn target falls in, rather than a single number.
   *
   * A fixed target is a quest a player recognises on sight and stops reading.
   * The range is also what makes the generator's determinism worth having: the
   * same date draws the same number, so a rerun of a missed cron cannot hand
   * somebody an easier day than the one they already started.
   */
  readonly target: QuestTarget;
  /**
   * What claiming it pays, in coins.
   *
   * A number here and a balance nowhere: **track H owns the wallet**, and this
   * catalogue deliberately does not wait for it. F.6 credits inside the
   * transaction that marks a quest claimed, so until H exists the reward is a
   * figure a quest is worth and nothing debits it.
   *
   * The daily-to-weekly ratio is roughly one to four rather than one to seven:
   * a weekly set that pays a week of dailies makes the dailies pointless, and
   * one that pays more makes logging in once a week the better strategy.
   */
  readonly reward: number;
}

/**
 * One definition per identifier — exhaustively, which a test checks.
 *
 * The targets are the first pass and are meant to be argued with. What they are
 * calibrated against is a round: three paragraphs, all falsified in the stub and
 * typically two to four in a real article, so "find twelve today" is three or
 * four rounds and not one.
 */
export const QUEST_CATALOGUE: Readonly<Record<QuestRuleId, QuestRule>> = {
  DAILY_FINISH_ROUNDS: {
    id: 'DAILY_FINISH_ROUNDS',
    period: 'daily',
    tally: 'rounds',
    qualifier: 'any',
    target: { min: 2, max: 4 },
    reward: 20,
  },
  DAILY_FIND_FALSIFICATIONS: {
    id: 'DAILY_FIND_FALSIFICATIONS',
    period: 'daily',
    tally: 'falsificationsFound',
    qualifier: 'any',
    target: { min: 6, max: 12 },
    reward: 25,
  },
  DAILY_SCORE_POINTS: {
    id: 'DAILY_SCORE_POINTS',
    period: 'daily',
    tally: 'points',
    qualifier: 'any',
    target: { min: 400, max: 900 },
    reward: 25,
  },
  // Not "buy no hints all day", which punishes playing a fourth round. One
  // round that needed no help is a thing a player can go and do.
  DAILY_UNAIDED_ROUND: {
    id: 'DAILY_UNAIDED_ROUND',
    period: 'daily',
    tally: 'rounds',
    qualifier: 'noHints',
    target: { min: 1, max: 2 },
    reward: 25,
  },
  DAILY_NOTHING_WRONGLY_MARKED: {
    id: 'DAILY_NOTHING_WRONGLY_MARKED',
    period: 'daily',
    tally: 'rounds',
    qualifier: 'nothingWronglyMarked',
    target: { min: 1, max: 2 },
    reward: 30,
  },
  WEEKLY_FINISH_ROUNDS: {
    id: 'WEEKLY_FINISH_ROUNDS',
    period: 'weekly',
    tally: 'rounds',
    qualifier: 'any',
    target: { min: 10, max: 18 },
    reward: 80,
  },
  WEEKLY_FIND_FALSIFICATIONS: {
    id: 'WEEKLY_FIND_FALSIFICATIONS',
    period: 'weekly',
    tally: 'falsificationsFound',
    qualifier: 'any',
    target: { min: 30, max: 55 },
    reward: 100,
  },
  WEEKLY_SCORE_POINTS: {
    id: 'WEEKLY_SCORE_POINTS',
    period: 'weekly',
    tally: 'points',
    qualifier: 'any',
    target: { min: 2500, max: 4500 },
    reward: 100,
  },
  // The one that rewards the skill the game is about, and the reason
  // `perfect` is not spelled out anywhere but `isPerfectRound`.
  WEEKLY_PERFECT_ROUNDS: {
    id: 'WEEKLY_PERFECT_ROUNDS',
    period: 'weekly',
    tally: 'rounds',
    qualifier: 'perfect',
    target: { min: 2, max: 4 },
    reward: 120,
  },
  // Weekly and not daily on purpose: a room needs somebody else in it, and a
  // daily quest a player cannot complete alone is a daily quest that expires.
  WEEKLY_MULTIPLAYER_ROUNDS: {
    id: 'WEEKLY_MULTIPLAYER_ROUNDS',
    period: 'weekly',
    tally: 'rounds',
    qualifier: 'multiplayer',
    target: { min: 3, max: 6 },
    reward: 110,
  },
};

/** Every rule, in the order the identifiers list them. */
export const QUEST_RULES: readonly QuestRule[] = QUEST_RULE_IDS.map(
  (id) => QUEST_CATALOGUE[id],
);

/** The rules a set for `period` is drawn from. F.2 draws; this only filters. */
export function questRulesFor(period: QuestPeriod): readonly QuestRule[] {
  return QUEST_RULES.filter((rule) => rule.period === period);
}

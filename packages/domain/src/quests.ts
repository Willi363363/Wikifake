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
// One thing the schema cannot answer, and one this comment got wrong about it.
//
// **A streak has no time dimension.** `player_stats` holds the current and the
// best streak as running totals with no date on them, so "a streak of three
// today" is not answerable and no rule below asks for it.
//
// **Items used *are* recorded, and F.1 said they were not.** `audit.ts`'s
// `item_use` has carried `caster_id`, `item_id` and `used_at` since phase 2, and
// a join through `participant` reaches the player — so "cast three items this
// week" is a rule this catalogue may express after all. What misled F.1 was
// `participant.score_stolen`, which is indeed what was done *to* a player; the
// caster's side is one table over. Found while F.3 was reading the schema next
// door. No rule uses it yet, and the correction is here so that the next one
// may.

import type { CalendarPeriod } from './periods.js';

/**
 * The two periods a set is drawn for. Monthly only if it is free — track F.
 *
 * An alias rather than its own union since G.3: `CalendarPeriod` is the same
 * pair, and two unions spelling out the same two strings are two places for a
 * third to be added to only one of them.
 */
export type QuestPeriod = CalendarPeriod;

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
export type QuestTally =
  'rounds' | 'falsificationsFound' | 'points' | 'distinctArticles' | 'itemsCast';

/*
 * The last two arrived at F.9, from columns the schema had carried all along.
 *
 * **`distinctArticles` counts `source_url`, not `topic`.** Both would work —
 * `topic` is the *resolved* Wikipedia title and not what a player typed, which
 * `article/src/source.ts` says where it sets it — but a URL is one page by
 * construction where a title is one page by convention. (`admin-content.ts`
 * describes `topic` as "what a player typed or a room voted for". That is stale,
 * and it is the reason this comment names its source rather than its column.)
 *
 * It is also the one tally that is **not a sum**: two rounds on the same article
 * are one article. `progressFor` says so in a case of its own, and nothing about
 * the rest of the reader changes.
 *
 * **`itemsCast` is weekly-only, for F.1's reason about multiplayer.** `with_items`
 * belongs to `room` and a solo game has no room, so casting is a thing only a
 * room affords — a daily quest asking for it would expire for anybody playing
 * alone.
 */

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
  'DAILY_PERFECT_ROUND',
  'DAILY_UNAIDED_FALSIFICATIONS',
  'DAILY_CLEAN_POINTS',
  'WEEKLY_FINISH_ROUNDS',
  'WEEKLY_FIND_FALSIFICATIONS',
  'WEEKLY_SCORE_POINTS',
  'WEEKLY_PERFECT_ROUNDS',
  'WEEKLY_MULTIPLAYER_ROUNDS',
  'WEEKLY_UNAIDED_ROUNDS',
  'WEEKLY_CLEAN_ROUNDS',
  'WEEKLY_PERFECT_POINTS',
  'DAILY_DISTINCT_ARTICLES',
  'WEEKLY_DISTINCT_ARTICLES',
  'WEEKLY_CAST_ITEMS',
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
  // F.8 — the three pairs below were computable the day F.4 shipped. Written
  // now because the generator draws 3 of 5, so five rules is ten possible days.
  //
  // Perfect is every falsification found and nothing true marked, so one is a
  // day's work and the reward is the highest a day pays.
  DAILY_PERFECT_ROUND: {
    id: 'DAILY_PERFECT_ROUND',
    period: 'daily',
    tally: 'rounds',
    qualifier: 'perfect',
    target: { min: 1, max: 2 },
    reward: 40,
  },
  // Lower than DAILY_FIND_FALSIFICATIONS' 6–12 rather than equal to it: the
  // same count without the hints on offer is a harder day, not the same one.
  // This is the rule that lowers the daily floor for this tally to 4, which is
  // what the weekly side has to clear.
  DAILY_UNAIDED_FALSIFICATIONS: {
    id: 'DAILY_UNAIDED_FALSIFICATIONS',
    period: 'daily',
    tally: 'falsificationsFound',
    qualifier: 'noHints',
    target: { min: 4, max: 8 },
    reward: 30,
  },
  // Points, but only from rounds where nothing true was marked. Well under
  // DAILY_SCORE_POINTS' 400–900 for the same reason, and it moves that tally's
  // daily floor to 250.
  DAILY_CLEAN_POINTS: {
    id: 'DAILY_CLEAN_POINTS',
    period: 'daily',
    tally: 'points',
    qualifier: 'nothingWronglyMarked',
    target: { min: 250, max: 500 },
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
  // Roughly one unaided round most days, rather than seven — a weekly that
  // needs every day is a weekly a player abandons on the day they miss.
  WEEKLY_UNAIDED_ROUNDS: {
    id: 'WEEKLY_UNAIDED_ROUNDS',
    period: 'weekly',
    tally: 'rounds',
    qualifier: 'noHints',
    target: { min: 5, max: 9 },
    reward: 110,
  },
  WEEKLY_CLEAN_ROUNDS: {
    id: 'WEEKLY_CLEAN_ROUNDS',
    period: 'weekly',
    tally: 'rounds',
    qualifier: 'nothingWronglyMarked',
    target: { min: 6, max: 10 },
    reward: 110,
  },
  // The hardest rule in the catalogue, and the best paid: points, counted only
  // from rounds that were perfect. Its floor clears the daily floor for this
  // tally, which DAILY_CLEAN_POINTS just moved to 250.
  WEEKLY_PERFECT_POINTS: {
    id: 'WEEKLY_PERFECT_POINTS',
    period: 'weekly',
    tally: 'points',
    qualifier: 'perfect',
    target: { min: 1200, max: 2200 },
    reward: 130,
  },
  // F.9 — two or three articles is a day that went somewhere, and the ceiling
  // is deliberately low: the quest is meant to move a player off one subject,
  // not to make them abandon a run they were enjoying.
  DAILY_DISTINCT_ARTICLES: {
    id: 'DAILY_DISTINCT_ARTICLES',
    period: 'daily',
    tally: 'distinctArticles',
    qualifier: 'any',
    target: { min: 2, max: 3 },
    reward: 30,
  },
  WEEKLY_DISTINCT_ARTICLES: {
    id: 'WEEKLY_DISTINCT_ARTICLES',
    period: 'weekly',
    tally: 'distinctArticles',
    qualifier: 'any',
    target: { min: 8, max: 14 },
    reward: 100,
  },
  // Weekly only — a room is what affords an item at all. Beside
  // WEEKLY_MULTIPLAYER_ROUNDS and for the same reason.
  WEEKLY_CAST_ITEMS: {
    id: 'WEEKLY_CAST_ITEMS',
    period: 'weekly',
    tally: 'itemsCast',
    qualifier: 'any',
    target: { min: 10, max: 20 },
    reward: 100,
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

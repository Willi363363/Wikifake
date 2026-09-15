// The badge catalogue — step M.1.
//
// Beside the scoring scale, the item catalogue, the quest catalogue and the
// cosmetics catalogue, and for the same reason all four give: a business rule
// that must exist in exactly one place.
//
// **A badge carries no content.** Track F's constraint is the owner's — *once
// the app is launched I want nothing left to do* — and it is inherited whole: a
// badge is an identifier, a metric and a threshold, and its name belongs to the
// i18n catalogue keyed by that identifier. A rule carrying a sentence is a rule
// nobody can translate, which is the argument `items.ts` makes first.
//
// **Everything a badge reads is a figure `PlayerStats` already carries**, and
// three of the five are themselves derived there rather than stored —
// `averageScore`, `accuracy` and `gamesAbandoned`, for the reason
// `05-accounts.md` gives about a column that can disagree with its own inputs.
// A badge is one threshold further along the same argument, so it is derived too
// and never written down.
//
// What that costs is stated in `plans/product/14-badges.md` and is worth
// repeating where somebody will read it: **nothing knows when a badge was
// crossed**, so nothing can announce one. A badge that must announce itself
// needs a row, and a row needs a migration and an argument.

/**
 * What a badge reads. Five figures, each one a counter or a ratio over them.
 *
 * There is deliberately no `currentStreak`: a badge is a thing held, and a
 * current streak is a thing lost. `bestStreak` is the same achievement without
 * the property of being taken away by one bad round — and a badge that
 * disappears is worse than no badge, for the reason F.4 refuses progress that
 * retreats.
 */
export type BadgeMetric =
  'gamesFinished' | 'falsificationsFound' | 'bestScore' | 'bestStreak' | 'accuracy';

/** The metrics that are ratios, and therefore need a floor. A test holds it. */
export const RATIO_METRICS: readonly BadgeMetric[] = ['accuracy'];

/**
 * The identifiers, and the contract for everything downstream.
 *
 * **The threshold is in the name**, the way a quest identifier spells out its
 * period: the same idea at two thresholds is two badges, not one badge with a
 * table, and a screen keys its copy on the identifier without composing a
 * string. It costs a rename to recalibrate a rung — which is free here, because
 * nothing stores a badge.
 */
export const BADGE_IDS = [
  'FINISHED_1',
  'FINISHED_10',
  'FINISHED_50',
  'FINISHED_200',
  'FOUND_25',
  'FOUND_100',
  'FOUND_500',
  'STREAK_3',
  'STREAK_10',
  'STREAK_25',
  'SCORE_300',
  'SCORE_500',
  'SCORE_700',
  'ACCURACY_75',
  'ACCURACY_90',
] as const;

export type BadgeId = (typeof BADGE_IDS)[number];

export interface Badge {
  readonly id: BadgeId;
  readonly metric: BadgeMetric;
  /** Held at or above this value. Ratios are a fraction of one, not a percentage. */
  readonly threshold: number;
  /**
   * Finished rounds required before the metric is read at all.
   *
   * Zero for a counter, which cannot be reached without playing. It exists for
   * the ratios: a player who finished one perfect round has an accuracy of 1,
   * and without this they would hold the top rung above somebody at 0.94 over
   * four hundred rounds — the opposite of what the badge says.
   */
  readonly minFinished: number;
}

/**
 * One definition per identifier — exhaustively, which a test checks.
 *
 * Five ladders of three or four rungs, so there is always a next one. The score
 * rungs are calibrated against the scale rather than guessed: `PER_TRUE_POSITIVE`
 * is 150 and a real article carries two to four falsifications, so a strong
 * round is roughly 300 to 700 once the time bonus is in — which is what these
 * are. They are a first pass and are meant to be argued with.
 */
export const BADGE_CATALOGUE: Readonly<Record<BadgeId, Badge>> = {
  FINISHED_1: { id: 'FINISHED_1', metric: 'gamesFinished', threshold: 1, minFinished: 0 },
  FINISHED_10: {
    id: 'FINISHED_10',
    metric: 'gamesFinished',
    threshold: 10,
    minFinished: 0,
  },
  FINISHED_50: {
    id: 'FINISHED_50',
    metric: 'gamesFinished',
    threshold: 50,
    minFinished: 0,
  },
  FINISHED_200: {
    id: 'FINISHED_200',
    metric: 'gamesFinished',
    threshold: 200,
    minFinished: 0,
  },

  FOUND_25: {
    id: 'FOUND_25',
    metric: 'falsificationsFound',
    threshold: 25,
    minFinished: 0,
  },
  FOUND_100: {
    id: 'FOUND_100',
    metric: 'falsificationsFound',
    threshold: 100,
    minFinished: 0,
  },
  FOUND_500: {
    id: 'FOUND_500',
    metric: 'falsificationsFound',
    threshold: 500,
    minFinished: 0,
  },

  STREAK_3: { id: 'STREAK_3', metric: 'bestStreak', threshold: 3, minFinished: 0 },
  STREAK_10: { id: 'STREAK_10', metric: 'bestStreak', threshold: 10, minFinished: 0 },
  STREAK_25: { id: 'STREAK_25', metric: 'bestStreak', threshold: 25, minFinished: 0 },

  SCORE_300: { id: 'SCORE_300', metric: 'bestScore', threshold: 300, minFinished: 0 },
  SCORE_500: { id: 'SCORE_500', metric: 'bestScore', threshold: 500, minFinished: 0 },
  SCORE_700: { id: 'SCORE_700', metric: 'bestScore', threshold: 700, minFinished: 0 },

  // Twenty rounds is the floor, and it is the same floor at both rungs: it is
  // there to make the ratio mean something, not to make the badge harder.
  ACCURACY_75: {
    id: 'ACCURACY_75',
    metric: 'accuracy',
    threshold: 0.75,
    minFinished: 20,
  },
  ACCURACY_90: { id: 'ACCURACY_90', metric: 'accuracy', threshold: 0.9, minFinished: 20 },
};

/** Every badge, in the order the identifiers list them. */
export const BADGES: readonly Badge[] = BADGE_IDS.map((id) => BADGE_CATALOGUE[id]);

/**
 * What a badge reads, as a reader has it.
 *
 * `PlayerStats` in `@wikifake/db` is structurally this and more, so it passes
 * without a mapping — and this package stays unable to import that one, which is
 * the boundary F.4 defends: data does not depend on rules.
 *
 * `bestScore` and `accuracy` are null until there is something to read, and null
 * is **not** zero. A player who has finished nothing has no best score; treating
 * that as a score of nought would be an answer where there is none.
 */
export interface BadgeStats {
  readonly gamesFinished: number;
  readonly falsificationsFound: number;
  readonly bestScore: number | null;
  readonly bestStreak: number;
  readonly accuracy: number | null;
}

/** The figure a metric reads, or null where there is nothing to read yet. */
function valueOf(metric: BadgeMetric, stats: BadgeStats): number | null {
  switch (metric) {
    case 'gamesFinished':
      return stats.gamesFinished;
    case 'falsificationsFound':
      return stats.falsificationsFound;
    case 'bestScore':
      return stats.bestScore;
    case 'bestStreak':
      return stats.bestStreak;
    case 'accuracy':
      return stats.accuracy;
  }
}

/** Whether this player holds this badge. One place, so a screen cannot disagree. */
export function holdsBadge(badge: Badge, stats: BadgeStats): boolean {
  if (stats.gamesFinished < badge.minFinished) return false;

  const value = valueOf(badge.metric, stats);

  return value !== null && value >= badge.threshold;
}

/** Everything held, in catalogue order. */
export function badgesEarned(stats: BadgeStats): readonly Badge[] {
  return BADGES.filter((badge) => holdsBadge(badge, stats));
}

/**
 * The next rung on a metric's ladder, or null at the top of it.
 *
 * Here rather than on the screen because *which badge is next* is a fact about
 * the catalogue: a screen computing it would be a second place that can disagree
 * about the order of the rungs. It is what makes the profile a ladder rather
 * than a list of things already true.
 *
 * The lowest unheld rung, not the one after the highest held: a player who
 * cleared a floor they later fell under — impossible for a counter, possible for
 * a ratio — is shown the rung they are actually missing.
 */
export function nextBadgeIn(metric: BadgeMetric, stats: BadgeStats): Badge | null {
  return (
    BADGES.filter((badge) => badge.metric === metric)
      .filter((badge) => !holdsBadge(badge, stats))
      .sort((left, right) => left.threshold - right.threshold)[0] ?? null
  );
}

/** Whether a string is an identifier this catalogue knows. */
export function isBadgeId(value: string): value is BadgeId {
  return Object.hasOwn(BADGE_CATALOGUE, value);
}

// The date range every section is read through — step I.8.
//
// **A range in the URL, not in a cookie and not in state.** Two links per
// preset, the server renders what they ask for, and a browser with no
// JavaScript gets every one of them — the same decision G.5's leaderboard made
// about its periods, for the same reasons: a range is bookmarkable, shareable,
// and survives the reload somebody does when a figure surprises them.
//
// **Not every section can honour it, and that is the interesting part.** The
// panel reads three kinds of thing:
//
//   - **events with a timestamp** — a round, a model call. A range is a `where`
//     clause, and the figure means exactly what it says;
//   - **a cohort** — accounts, which have a creation date. A range picks *who*
//     rather than *when*, which is what an activation figure has always meant;
//   - **a running total** — `player_stats.games_finished`, kept since E.4 as an
//     aggregate maintained rather than recomputed. **There is no date on it**,
//     so "rounds finished this week" is a question the schema cannot answer.
//
// Applying a range to the third kind anyway would produce a number that looks
// ranged and is not, which is the worst of the three outcomes. So those figures
// say on the screen that they are all-time, and the range control says which
// sections it moves.
import { periodIndexOf, periodWindowOf, MS_PER_DAY } from '@wikifake/domain';

/** Half-open, like every window in this repository: `from <= at < to`. */
export interface Range {
  readonly fromMs: number;
  readonly toMs: number;
  /** Which preset produced it, for the chooser. `custom` for anything else. */
  readonly preset: Preset;
}

/**
 * The presets, in days, and `all` for everything.
 *
 * Seven, thirty and ninety: a week to see what just happened, a month to see a
 * trend, a quarter to see whether the month was one. `all` is not a number of
 * days — it is the absence of a lower bound, which is a different query rather
 * than a very large range.
 */
export const PRESETS = ['7d', '30d', '90d', 'all'] as const;
export type Preset = (typeof PRESETS)[number] | 'custom';

/** What the panel shows when nobody has asked for anything. */
export const DEFAULT_PRESET = '30d' satisfies Preset;

const DAYS: Readonly<Record<string, number>> = { '7d': 7, '30d': 30, '90d': 90 };

/**
 * The earliest instant anything in this game can have happened.
 *
 * Zero, and it is the epoch rather than a guess at a launch date: an `all`
 * range must not exclude a row because somebody's clock was wrong, and a
 * bound of zero is one no row can be below.
 */
const BEGINNING = 0;

/**
 * The range a query string asks for.
 *
 * `atMs` is a parameter like every clock here: the page passes now and a test
 * passes a Thursday.
 *
 * **A range ends at the end of today**, not at this instant. A player who
 * finished a round ten minutes ago is in "the last seven days", and a bound of
 * *now* would leave them out of a figure a reader would expect to include them
 * — and would make the same page show different numbers on each refresh.
 *
 * Anything unrecognised is the default rather than an error. A panel is not a
 * form: a mistyped query string should show a month, not a 400.
 */
export function rangeFrom(preset: string | undefined, atMs: number): Range {
  const asked = preset ?? DEFAULT_PRESET;
  const endOfToday = periodWindowOf('daily', periodIndexOf('daily', atMs)).toMs;

  if (asked === 'all') return { fromMs: BEGINNING, toMs: endOfToday, preset: 'all' };

  const days = DAYS[asked] ?? DAYS[DEFAULT_PRESET];
  return {
    fromMs: endOfToday - (days as number) * MS_PER_DAY,
    toMs: endOfToday,
    // An unrecognised value is served the default's *range* and the default's
    // *name*, so the chooser highlights what is actually being shown.
    preset: (asked in DAYS ? asked : DEFAULT_PRESET) as Preset,
  };
}

/**
 * Whether this range covers everything there is.
 *
 * Asked by the read paths so that `all` puts **no clause at all** on a
 * timestamp rather than a bound of zero: G.3 made the same distinction for the
 * all-time leaderboard, and for the same reason — a query given an artificial
 * range is an index scan proving every row qualifies.
 */
export function isAllTime(range: Range): boolean {
  return range.fromMs <= BEGINNING;
}

/** What a query takes: the window, or **null for no clause at all**. */
export function windowOf(range: Range): { fromMs: number; toMs: number } | null {
  return isAllTime(range) ? null : { fromMs: range.fromMs, toMs: range.toMs };
}

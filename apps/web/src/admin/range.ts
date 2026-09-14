// The date range every section is read through — steps I.8 and K.2.
//
// **A range in the URL, not in a cookie and not in state.** One link per
// preset, the server renders what they ask for, and a browser with no
// JavaScript gets every one of them — the same decision G.5's leaderboard made
// about its periods, for the same reasons: a range is bookmarkable, shareable,
// and survives the reload somebody does when a figure surprises them.
//
// **The presets are calendar periods, and K.2 chose that deliberately.** I.8
// shipped rolling windows — 7, 30 and 90 days — and the two are not the same
// question. *This month* on the 2nd is two days of data and *30 days* never is.
// Rolling windows are the comparable ones; calendar periods are the ones people
// actually ask each other about, and an admin panel is read by somebody asking
// "how is September going", not "how do any thirty consecutive days compare".
// The cost of the choice is that two calendar periods are uneven, and the bar
// says which days it covers so nobody compares them blind.
//
// **Days are UTC days**, which is what `periodIndexOf` already decides for every
// quest and every board, and what `TIME_ZONE` makes the interface print. A month
// beginning at midnight Paris and a daily quest turning over at midnight UTC
// would be two clocks on one screen.
//
// **Not every section can honour a range, and that is the interesting part.**
// The panel reads three kinds of thing:
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
// say on the screen that they are all-time, and the period bar says which
// sections it moves.
import { periodIndexOf, periodWindowOf, MS_PER_DAY } from '@wikifake/domain';

/** Half-open, like every window in this repository: `from <= at < to`. */
export interface Range {
  readonly fromMs: number;
  readonly toMs: number;
  /** Which preset produced it, for the bar. `custom` for a pair of dates. */
  readonly preset: Preset;
}

/**
 * The presets, in the order the bar draws them.
 *
 * Today, then the three calendar periods that contain it, then everything —
 * each one a window the one after it contains, so moving down the row is always
 * *the same question over more time* rather than a different question.
 *
 * `custom` is not here: it is a preset a reader can be *on* and never one the
 * bar can link to, because it takes two dates the row does not carry.
 */
export const PRESETS = ['24h', 'week', 'month', 'year', 'all'] as const;
export type Preset = (typeof PRESETS)[number] | 'custom';

/** What the panel shows when nobody has asked for anything. */
export const DEFAULT_PRESET = 'month' satisfies Preset;

/**
 * The earliest instant anything in this game can have happened.
 *
 * Zero, and it is the epoch rather than a guess at a launch date: an `all`
 * range must not exclude a row because somebody's clock was wrong, and a
 * bound of zero is one no row can be below.
 */
const BEGINNING = 0;

/** Midnight after the day `atMs` falls in — where every range ends. */
function endOfDay(atMs: number): number {
  return periodWindowOf('daily', periodIndexOf('daily', atMs)).toMs;
}

/** Midnight at the start of the day `atMs` falls in. */
function startOfDay(atMs: number): number {
  return periodWindowOf('daily', periodIndexOf('daily', atMs)).fromMs;
}

/**
 * The first instant of the calendar period `preset` names, in UTC.
 *
 * `24h` is today rather than the last twenty-four hours, and the label says
 * *24 h* because that is what the owner asked to read. The two differ only in
 * the morning, and a figure that changed meaning between breakfast and lunch
 * would be worse than one that is plainly "since midnight".
 *
 * Weeks are `periodWindowOf`'s weeks, so they start on Monday and agree with
 * every quest and every board. Months and years need civil-date arithmetic,
 * which `@wikifake/domain` forbids itself — `purity.test.ts` refuses `new Date(`
 * in that package — so they are computed here, where a clock is already allowed.
 */
function startOf(preset: (typeof PRESETS)[number], atMs: number): number {
  if (preset === 'all') return BEGINNING;
  if (preset === '24h') return startOfDay(atMs);
  if (preset === 'week') {
    return periodWindowOf('weekly', periodIndexOf('weekly', atMs)).fromMs;
  }

  const at = new Date(atMs);
  return preset === 'month'
    ? Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)
    : Date.UTC(at.getUTCFullYear(), 0, 1);
}

/** Whether a string is one of the presets, narrowing as it answers. */
function isPreset(asked: string): asked is (typeof PRESETS)[number] {
  return (PRESETS as readonly string[]).includes(asked);
}

/**
 * The two dates a custom range is asked for, as `YYYY-MM-DD`.
 *
 * A date and not an instant, because that is what a reader picks and what
 * `<input type="date">` submits. Both ends are **inclusive**: `to` is a day
 * that counts, so the window runs to midnight after it.
 */
export interface AskedDays {
  readonly from: string | undefined;
  readonly to: string | undefined;
}

/** `YYYY-MM-DD` at midnight UTC, or null for anything that is not a date. */
function dayAt(day: string | undefined): number | null {
  if (day === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const at = Date.parse(`${day}T00:00:00.000Z`);
  // `Date.parse` accepts 2026-02-31 on some runtimes and answers NaN on others;
  // checking the round trip makes the answer the same everywhere.
  return Number.isNaN(at) || new Date(at).toISOString().slice(0, 10) !== day ? null : at;
}

/** A day, the way the address and a date input both spell one. */
export function dayOf(atMs: number): string {
  return new Date(atMs).toISOString().slice(0, 10);
}

/** The last day a range covers — `toMs` is the midnight after it. */
export function lastDayOf(range: Range): string {
  return dayOf(range.toMs - 1);
}

/**
 * The range a query string asks for.
 *
 * `atMs` is a parameter like every clock here: the page passes now and a test
 * passes a Thursday.
 *
 * **A range ends at the end of today**, not at this instant. A player who
 * finished a round ten minutes ago is in "this week", and a bound of *now*
 * would leave them out of a figure a reader would expect to include them — and
 * would make the same page show different numbers on each refresh.
 *
 * Anything unrecognised is the default rather than an error. A panel is not a
 * form: a mistyped query string should show a month, not a 400.
 */
export function rangeFrom(
  preset: string | undefined,
  atMs: number,
  days: AskedDays = { from: undefined, to: undefined },
): Range {
  const endOfToday = endOfDay(atMs);

  if (preset === 'custom') {
    const custom = customRange(days, atMs);
    if (custom !== null) return custom;
    // Two dates that do not parse are a link somebody edited by hand. The panel
    // shows the default rather than refusing, and names the default on the bar
    // so the reader is not told they are looking at something they are not.
  }

  const asked = preset !== undefined && isPreset(preset) ? preset : DEFAULT_PRESET;
  return { fromMs: startOf(asked, atMs), toMs: endOfToday, preset: asked };
}

/**
 * A pair of days as a range, or **null when they are not a pair of days**.
 *
 * Three ways to fail, and each is a link that was typed rather than clicked:
 * a date that is not one, a `from` after its `to`, and a `to` in the future.
 * The last is clamped rather than refused — asking for a range that ends next
 * March is asking for everything up to now, and that is what it gets — because
 * the alternative is a panel that answers a reasonable question with the
 * default and no explanation.
 */
function customRange(days: AskedDays, atMs: number): Range | null {
  const from = dayAt(days.from);
  const to = dayAt(days.to);
  if (from === null || to === null || from > to) return null;

  const endOfToday = endOfDay(atMs);
  // `to` is inclusive, so the window runs to the midnight *after* it.
  return { fromMs: from, toMs: Math.min(to + MS_PER_DAY, endOfToday), preset: 'custom' };
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

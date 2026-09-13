// The range a page was asked for — step K.1.
//
// I.8 put the range in the address so it is bookmarkable and shareable, and
// eight routes now read it instead of one. This is that reading, in one place:
// eight copies of the same three lines is eight places for them to drift.
//
// **The clock comes from here rather than from the read path**, which is the
// split every feature in this repository makes: a route is where a real clock
// is allowed to come from.
import { rangeFrom, type Range } from './range.js';

/** What Next hands a page for `?range=`, repeated parameters included. */
export type AskedFor = Promise<Record<string, string | string[] | undefined>>;

export async function rangeAsked(searchParams: AskedFor): Promise<Range> {
  const asked = (await searchParams)['range'];
  // An array is what Next gives for a repeated parameter; the first wins, and
  // anything unrecognised falls back to the default rather than refusing — a
  // panel is not a form.
  return rangeFrom(Array.isArray(asked) ? asked[0] : asked, Date.now());
}

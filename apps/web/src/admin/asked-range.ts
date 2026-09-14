// The range a page was asked for — steps K.1 and K.2.
//
// I.8 put the range in the address so it is bookmarkable and shareable, and
// eight routes now read it instead of one. This is that reading, in one place:
// eight copies of the same three lines is eight places for them to drift.
//
// **The clock comes from here rather than from the read path**, which is the
// split every feature in this repository makes: a route is where a real clock
// is allowed to come from.
//
// K.2 added the two days a custom range carries. They are read here rather than
// by each page for the same reason the preset is: a page that read `from` and
// forgot `to` would silently show a preset instead, and nothing would say so.
import { rangeFrom, type Range } from './range.js';

/** What Next hands a page for `?range=`, repeated parameters included. */
export type AskedFor = Promise<Record<string, string | string[] | undefined>>;

/** An array is what Next gives for a repeated parameter; the first wins. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function rangeAsked(searchParams: AskedFor): Promise<Range> {
  const asked = await searchParams;
  // Anything unrecognised falls back to the default rather than refusing — a
  // panel is not a form.
  return rangeFrom(first(asked['range']), Date.now(), {
    from: first(asked['from']),
    to: first(asked['to']),
  });
}

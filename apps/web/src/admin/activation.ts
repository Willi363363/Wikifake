// Activation and return — step I.4.
//
// **The number worth building the panel for**, in the track's own words. The
// counts are `@wikifake/db`'s one query; what this file owns is the ratio, and
// there is exactly one implementation of it.
//
// That matters more than it sounds. The exit gate says *no in-memory maths that
// a second implementation could disagree with*, and a percentage is precisely
// the shape of thing that gets recomputed in a template — one place rounding to
// a whole number and another to one decimal, both defensible, quietly
// disagreeing. `shareOf` is the only division in this feature.
import { selectFunnel, type Funnel } from '@wikifake/db';
import type { Database } from '@wikifake/db';

import { windowOf, type Range } from './range.js';

export interface ActivationContext {
  readonly db: Database['db'];
}

/**
 * A share of a whole, or **null when there is no whole**.
 *
 * Null and not zero, and the difference is the whole point: nobody has signed
 * up is not *nought per cent of people played*. A panel showing 0% on its
 * headline figure the day before launch would be reporting a failure that has
 * not happened yet.
 *
 * Not rounded here. Rounding is presentation, and a number rounded before it
 * reaches the screen is a number the screen cannot format for its locale.
 */
export function shareOf(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return part / whole;
}

/** One step of the funnel, with its share of the step above and of the top. */
export interface Step {
  readonly name: 'created' | 'started' | 'finished' | 'returned';
  readonly count: number;
  /**
   * Of the step immediately above — the drop-off that step is responsible for.
   *
   * Null for the first step, which has nothing above it, and null wherever the
   * step above is empty.
   */
  readonly ofPrevious: number | null;
  /** Of accounts created, so the whole funnel is readable in one column. */
  readonly ofCreated: number | null;
}

export interface ActivationView {
  readonly funnel: readonly Step[];
  /**
   * The two ratios the track names, lifted out of the funnel.
   *
   * Named separately because they are the answer and the rest is working:
   * *of the accounts created, how many played a game* and *of those, how many
   * came back*.
   */
  readonly activation: number | null;
  readonly returnRate: number | null;
}

/**
 * The activation section, ready to render.
 *
 * The funnel is built in order, each step measured against the one above it —
 * so *where* people are lost is readable rather than inferred from four totals.
 */
export async function readActivation(
  context: ActivationContext,
  range: Range,
): Promise<ActivationView> {
  const counts: Funnel = await selectFunnel(context.db, windowOf(range));

  const order: readonly Step['name'][] = ['created', 'started', 'finished', 'returned'];
  const funnel = order.map((name, at) => {
    const above = at === 0 ? null : counts[order[at - 1] as Step['name']];
    return {
      name,
      count: counts[name],
      ofPrevious: above === null ? null : shareOf(counts[name], above),
      ofCreated: at === 0 ? null : shareOf(counts[name], counts.created),
    };
  });

  return {
    funnel,
    activation: shareOf(counts.finished, counts.created),
    // Of the people who finished a round, not of everybody: coming back is a
    // thing only somebody who played can do, and dividing by accounts created
    // would blame the return rate for a sign-up funnel's losses.
    returnRate: shareOf(counts.returned, counts.finished),
  };
}

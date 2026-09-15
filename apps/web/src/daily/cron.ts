// The daily article cron — step N.4.
//
// **It makes nothing the read path could not make on demand.** That is worth
// stating first, because it is what the whole design rests on and it is F.5's
// rule inherited whole: `ensureDailyArticle` generates the day for whoever asks
// first, so this run is a pre-warm and never a prerequisite. Stop the cron for a
// week and every day still has its article; what players lose is the wait on the
// first request of each morning.
//
// So the two properties the track asks for are free rather than engineered.
// **Idempotent**, because the claim is a primary key: a second run for the same
// day claims nothing and reports `generated: false`. **Self-healing**, because
// the guarantee was never here.
import { openClaimsBefore, reopenStaleClaim, selectDay } from '@wikifake/db';
import { periodIndexOf } from '@wikifake/domain';

import {
  ensureDailyArticle,
  CLAIM_STALE_AFTER_MS,
  type DailyDependencies,
  type DailyOutcome,
} from './article.js';

export interface DailyCronOutcome {
  readonly day: number;
  readonly status: DailyOutcome['status'];
  /** Whether this run is the one that made the day. False on a second run. */
  readonly generated: boolean;
  /** Dead claims given back. Zero every ordinary day. */
  readonly reopened: number;
}

/**
 * Sweeps dead claims, then makes sure today has an article.
 *
 * **The sweep runs first**, and on every day rather than only on today's. A
 * claim that died holds *its* day for ever — nobody asks for yesterday's article,
 * so the read path's own recovery never fires on it, and the row would sit there
 * as a claim nobody can fill. It is the one thing here the read path does not
 * already do.
 *
 * A failure is not swallowed. One bad day stops the run, the schedule retries
 * tomorrow, and the read path has been covering everybody the whole time —
 * swallowing it would turn a broken cron into a silent one.
 */
export async function prepareDailyArticle(
  dependencies: DailyDependencies,
  atMs: number,
): Promise<DailyCronOutcome> {
  const deadline = new Date(atMs - CLAIM_STALE_AFTER_MS);
  const stale = await openClaimsBefore(dependencies.db, deadline);

  let reopened = 0;
  for (const claim of stale) {
    if (await reopenStaleClaim(dependencies.db, claim.day, deadline)) reopened += 1;
  }

  const day = periodIndexOf('daily', atMs);

  /*
   * Asked **before**, and that is the whole of `generated`.
   *
   * A second run for the same day also ends `ready`, so reading the outcome
   * alone would report every run as the one that made the day — and the
   * idempotence this step promises would be invisible in exactly the log that is
   * supposed to show it. The question is not *is there an article*, it is *did
   * this run make one*.
   */
  const before = await selectDay(dependencies.db, day);
  const outcome = await ensureDailyArticle(dependencies, atMs);

  return {
    day,
    status: outcome.status,
    generated: before === null && outcome.status === 'ready',
    reopened,
  };
}

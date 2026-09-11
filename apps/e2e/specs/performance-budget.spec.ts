// Step J.8 — a budget for the pages that had none.
//
// C.7 gave the landing one and CI has failed on it since: layouts that do not
// scale with frames, the worst throttled frame under 250ms, CLS under 0.1,
// blocking under 200ms. **Every other route had no number at all**, which the
// audit of J.1 found: a budget over one page is a budget over the page somebody
// was thinking about when they wrote it.
//
// The measurement is `vitals.ts`, shared with C.7's spec so that two budgets
// cannot disagree about what they measured.
//
// **Three numbers are asserted and the rest are reported**, and the split is not
// arbitrary. CLS and page weight do not depend on how fast the machine running
// this is — a ratio of the viewport and a count of bytes are the same on a
// laptop and on a loaded CI runner. Blocking time does depend on it, and is
// asserted anyway at a threshold loose enough to catch a regression rather than
// a busy afternoon. TTFB, FCP, LCP and load are printed: they are a baseline to
// compare against, and a build that failed on them would fail on somebody
// else's neighbour compiling something.
import { expect, test } from '@playwright/test';

import {
  PHONE,
  observeLargestPaint,
  readVitals,
  reportVitals,
  throttle,
  type Vitals,
} from './vitals.js';

/**
 * The pages a visitor can reach without an account or a game.
 *
 * The round is not here and cannot be: it needs a generated article, and its
 * cadence is C.7's subject anyway. What this covers is every screen somebody
 * arrives on — which is where a budget is spent before anybody has decided to
 * play.
 */
const ROUTES = ['/', '/play', '/faq', '/privacy', '/terms', '/leaderboard'] as const;

/**
 * The weight of one page load, in kilobytes, measured before it was written.
 *
 * Every route above, on a production build, throttled, at the run that set this:
 *
 * ```
 * /             300kB over 20 requests
 * /play         307kB over 33
 * /faq          266kB over 17
 * /privacy      266kB over 17
 * /terms        266kB over 17
 * /leaderboard  282kB over 34
 * ```
 *
 * 400 is a third again as much as the heaviest. A ceiling at the measurement
 * would fail the day somebody adds a paragraph; one at twice it would not
 * notice a charting library arriving. A third is the band where the first
 * unnecessary dependency shows up and ordinary work does not.
 *
 * It counts **everything the page fetched** — the document, the JavaScript, the
 * fonts. A budget over scripts alone would miss the most expensive thing
 * anybody is likely to add to a page of prose, which is a picture.
 */
const KILOBYTE_BUDGET = 400;

/** The blocking time above which a phone feels the page rather than reads it. */
const BLOCKING_BUDGET = 200;

/** Cumulative layout shift: 0.1 is the threshold Core Web Vitals calls good. */
const SHIFT_BUDGET = 0.1;

test.describe('J.8 — every entry screen has a number', () => {
  test.use(PHONE);

  for (const route of ROUTES) {
    test(`${route} arrives within its budget`, async ({ page }) => {
      await throttle(page);
      await observeLargestPaint(page);

      await page.goto(route, { waitUntil: 'load' });
      // A heading is the page having rendered rather than the document having
      // arrived: every one of these screens leads with one.
      await expect(page.getByRole('heading').first()).toBeVisible();
      // Long enough for the fonts to swap and for anything late to shift.
      await page.waitForTimeout(1500);

      const vitals: Vitals = await readVitals(page);

      // eslint-disable-next-line no-console
      console.log(reportVitals(`J.8 ${route}`, vitals));

      expect({ route, shifted: vitals.cls < SHIFT_BUDGET }).toEqual({
        route,
        shifted: true,
      });
      expect({ route, blocked: vitals.blocking < BLOCKING_BUDGET }).toEqual({
        route,
        blocked: true,
      });
      expect({ route, kilobytes: vitals.kilobytes < KILOBYTE_BUDGET }).toEqual({
        route,
        kilobytes: true,
      });
    });
  }
});

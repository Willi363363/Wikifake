// Step 8.9 — the reference journey: four players, one room, items on.
//
// Everything else in this repository is asserted without a browser, and better.
// What four contexts add is the only thing no unit suite can say: that the
// server keeps four clients agreeing, that an item thrown by one lands on
// another, and that **none of the four** holds the solution while the round is
// running.
//
// It is slow on purpose in one place. The first item wave is thirty seconds into
// the round — a rule carried over from `item_distribution_loop`, so that a round
// opens item-free — and there is no honest way to have items without waiting for
// them. Everything else in the journey is as short as it can be.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { expectAttribution, expectNoSolution } from './assertions.js';
import { arrive, everyoneSees, host, join, playARound } from './room-journey.js';

/** The wave, plus what it costs to schedule one. From `WAVE_INTERVAL_SECONDS`. */
const FIRST_WAVE_MS = 30_000;

const NICKNAMES = ['ada', 'bob', 'cleo', 'dee'] as const;

test.describe('8.9 — four players, one room, items included', () => {
  // Thirty seconds of waiting inside it, and four browser contexts around that.
  test.setTimeout(180_000);

  test('plays end to end, and no client holds the solution', async ({ browser }) => {
    // Four contexts: four `sessionStorage`s, four session tokens, four players
    // as far as the server can tell. One context with four tabs is one player
    // with four windows, which is a different test.
    const contexts: BrowserContext[] = [];
    for (const _nickname of NICKNAMES) contexts.push(await browser.newContext());

    try {
      const pages: Page[] = [];
      for (const context of contexts) pages.push(await arrive(context));

      const [first, ...rest] = pages;
      // Named rather than indexed from here on: `rest[0]` is `Page | undefined`
      // to the compiler, and every assertion on it would be optional-chained
      // into meaninglessness.
      const [second] = rest;
      if (first === undefined || second === undefined) {
        throw new Error('four players did not arrive');
      }

      const code = await host(first, NICKNAMES[0]);
      for (const [at, page] of rest.entries()) {
        await join(page, code, NICKNAMES[at + 1] ?? 'someone');
      }

      // Every screen agrees on who is here, because every screen is reading the
      // same `lobby_update` rather than counting.
      await everyoneSees(pages, NICKNAMES.length);

      await playARound(first, rest);

      // C1.1 and C6.1, on all four. This is the assertion the step names.
      for (const [at, page] of pages.entries()) {
        await expectNoSolution(page, `${NICKNAMES[at] ?? 'a player'}, during the round`);
        await expectAttribution(page);
      }

      // Marking is what the round is, and it reaches the others as a score.
      await first.getByRole('article').getByRole('button').first().click();
      await expect(second.getByRole('button', { name: /ranking/i })).toBeVisible({
        timeout: 20_000,
      });

      // — Items. The first wave is thirty seconds in, by design. —
      const bar = first.getByRole('toolbar', { name: 'Your items' });
      await expect(bar).toBeVisible({ timeout: FIRST_WAVE_MS + 20_000 });

      // Which item a player is dealt is a draw, so the journey does not know
      // whether this one asks for a target. The interface says: a card that
      // needs one says so in its own accessible name.
      const card = bar.getByRole('button').first();
      const label = (await card.getAttribute('aria-label')) ?? '';
      await card.click();

      if (label.includes('Asks for a target')) {
        await first.getByRole('radio', { name: NICKNAMES[1] }).click();
        await first.getByRole('button', { name: `Throw it at ${NICKNAMES[1]}` }).click();

        // It landed on the player it was thrown at, and they were told who by.
        await expect(second.getByText(/hit you with/)).toBeVisible({ timeout: 20_000 });
      } else {
        // The detector: it lands on the caster and answers with a paragraph.
        await expect(first.getByText(/detector/i)).toBeVisible({ timeout: 20_000 });
      }

      // Spent, and the server is what says so: the card leaves the hand on
      // `item_used`, not on the click.
      await expect(card).toHaveCount(0, { timeout: 20_000 });

      // An item that landed must not have brought the solution with it.
      for (const [at, page] of pages.entries()) {
        await expectNoSolution(page, `${NICKNAMES[at] ?? 'a player'}, after an item`);
      }

      // — The end. Everyone submits, and the round ends for the room. —
      for (const page of pages) {
        await page.getByRole('button', { name: 'Submit' }).click();
      }

      for (const [at, page] of pages.entries()) {
        await expect(page.getByRole('region', { name: 'Debrief' })).toBeVisible({
          timeout: 40_000,
        });
        // C1.2 — `game_end` is the only message that carries the solution, so
        // this is the first moment any of the four may hold it.
        await expect(page.getByText(/TRUTHMARKER/).first()).toBeVisible({
          timeout: 30_000,
        });
        // C6.1 — and after, on every one of them.
        await expectAttribution(page);
        // Four players ranked, on four screens. By the list's own name: the
        // debrief holds two, and the other one is the falsifications.
        await expect(
          page.getByRole('list', { name: 'Final ranking' }).getByRole('listitem'),
          `${NICKNAMES[at] ?? 'a player'} sees the whole room ranked`,
        ).toHaveCount(NICKNAMES.length);
      }
    } finally {
      for (const context of contexts) await context.close();
    }
  });
});

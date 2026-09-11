// Step E.3b.2 — a room round reaching the player who played it.
//
// This is the whole of what E.3b was for, asserted where it is visible to a
// person: a signed-in player joins a room, plays a round, and their **profile**
// counts it. Before E.3b.1 the round was never written down; before E.3b.2 it
// was written down and attributed to nobody. Both halves fail this.
//
// It runs through the entire wire and mocks none of it: the sign-up, the ticket
// the web application signs, the socket that carries it, the signature the
// realtime service checks, the `participant` row `createGame` opens with the
// account on it, the `record_results` effect, `recordSubmission`'s transaction,
// the `player_stats` increment inside it, and the server component that reads
// the row back. Nine things, and this is the only test that touches all nine.
import { expect, test } from '@playwright/test';

import { arrive, everyoneSees, host, join, playARound } from './room-journey.js';
import { someone } from './accounts.js';
import type { Page } from '@playwright/test';

/**
 * Ends the round, which is what `playARound` deliberately does not do.
 *
 * That helper stops when the article is on screen — every journey that uses it
 * is about what a player *sees*. This one is about what is written down when
 * the round is over, and a round nobody submits to is a round that has not
 * ended: `record_results` comes out of `endRound` and nowhere else.
 */
async function everyoneSubmits(pages: readonly Page[]): Promise<void> {
  // One mark each, so there is a submission to grade rather than an empty one.
  for (const page of pages) {
    await page.getByRole('article').getByRole('button').first().click();
  }
  for (const page of pages) {
    await page.getByRole('button', { name: 'Submit' }).click();
  }
  for (const page of pages) {
    await expect(page.getByRole('region', { name: 'Debrief' })).toBeVisible({
      timeout: 30_000,
    });
  }
}

test.describe('E.3b.2 — a room round counts for the player who played it', () => {
  test('shows on the profile of a signed-in host', async ({ browser }) => {
    const ada = someone('room');
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    try {
      const one = await hostContext.newPage();

      // Signed in **before** the room, which is the ordering that matters: the
      // ticket is minted from the session, so a player who signs in afterwards
      // would join the room as the guest they were.
      await one.goto('/sign-up');
      await one.getByLabel('Email', { exact: true }).fill(ada.email);
      await one.getByLabel('Pseudonym', { exact: true }).fill(ada.pseudonym);
      await one.getByLabel('Password', { exact: true }).fill(ada.password);
      await one.getByRole('button', { name: 'Create the account' }).click();
      await expect(one).toHaveURL(/\/play$/);

      // Nothing yet. This is what the assertion at the end is measured against.
      await one.goto('/profile');
      await expect(one.getByText(/No rounds yet/)).toBeVisible();

      // Back to the entry screen, which is where `host` starts.
      await one.goto('/play');
      const code = await host(one, 'ada');

      const two = await arrive(guestContext);
      await join(two, code, 'bob');
      await everyoneSees([one, two], 2);

      await playARound(one, [two]);
      await everyoneSubmits([one, two]);

      // The claim. A room round, on the profile of the account that played it.
      await one.goto('/profile');
      await expect(one.getByText(/No rounds yet/)).toHaveCount(0);
      await expect(one.locator('dl div', { hasText: 'Rounds finished' })).toContainText(
        '1',
      );
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });

  test('leaves a guest’s round attributed to their guest identity', async ({
    browser,
  }) => {
    /*
     * The other half of 4.3's promise, and the reason the ticket route creates
     * an identity rather than refusing one.
     *
     * A player who joins a room having never signed in still gets an anonymous
     * `user` row, so the round is attributed to *something* — and signing up
     * later moves it onto the real account through `attachGuestRecords`. What
     * is checked here is the visible end of that: the round they played as a
     * guest is on the profile of the account they create afterwards.
     */
    const bob = someone('room');
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    try {
      const one = await arrive(hostContext);
      const code = await host(one, 'ada');

      const two = await arrive(guestContext);
      await join(two, code, 'bob');
      await everyoneSees([one, two], 2);

      await playARound(one, [two]);
      await everyoneSubmits([one, two]);

      // Signed up **after** the round, which is the case 4.3 exists for.
      await two.goto('/sign-up');
      await two.getByLabel('Email', { exact: true }).fill(bob.email);
      await two.getByLabel('Pseudonym', { exact: true }).fill(bob.pseudonym);
      await two.getByLabel('Password', { exact: true }).fill(bob.password);
      await two.getByRole('button', { name: 'Create the account' }).click();
      await expect(two).toHaveURL(/\/play$/);

      await two.goto('/profile');
      await expect(two.getByText(/No rounds yet/)).toHaveCount(0);
      await expect(two.locator('dl div', { hasText: 'Rounds finished' })).toContainText(
        '1',
      );
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});

// Two browsers in one room.
//
// The journey from §6 of the plan, and the one thing no unit suite can say:
// that what one player does reaches the other, over a real socket, through a
// real Redis channel, into a real second document — and that the negative
// assertions hold on **both** of them.
//
// Two contexts rather than two engines. This phase's pitfall list says four
// browsers are slow and fragile and that the journey should be a single short
// one; two isolated contexts are two players as far as the server can tell, and
// they cost one browser launch.
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { expectAttribution, expectNoSolution } from './assertions.js';

/** A player with their own context, on the entry screen. */
async function player(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/play');
  return page;
}

test.describe('9.5 — two players, one room', () => {
  test('plays a round together, and neither page holds the solution', async ({
    browser,
  }) => {
    // Two contexts, so two `sessionStorage`s and two session tokens. One context
    // with two tabs is one player with two windows, which is a different test.
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    try {
      const host = await player(hostContext);
      await host.getByRole('tab', { name: 'Host' }).click();
      await host.getByLabel('Nickname').fill('ada');
      await host.getByRole('button', { name: 'Open a room' }).click();

      // From the URL, not from the heading: the entry screen has an `<h1>` too,
      // and reading it before the navigation lands reads "WikiFake".
      await host.waitForURL(/\/room\/[A-Z0-9]{6}$/, { timeout: 20_000 });
      const code = host.url().split('/').pop() ?? '';
      expect(code).toMatch(/^[A-Z0-9]{6}$/);

      const guest = await player(guestContext);
      await guest.getByRole('tab', { name: 'Join' }).click();
      await guest.getByLabel('Room code').fill(code);
      await guest.getByLabel('Nickname').fill('bob');
      await guest.getByRole('button', { name: 'Join' }).click();

      // The roster is the server's, on both screens: this is the half of the
      // current game that never worked, and the reason 7.3 reads `lobby_update`
      // rather than counting locally.
      await expect(host.getByText('Players (2)')).toBeVisible({ timeout: 20_000 });
      await expect(guest.getByText('Players (2)')).toBeVisible();

      // C1.7 — the host starts it, and only the host is offered the control.
      await expect(guest.getByRole('button', { name: /^Start/ })).toHaveCount(0);
      await host.getByRole('button', { name: /^Start/ }).click();

      // Starting opens the topic vote, on both screens: the round's subject is
      // the room's decision, not the host's.
      await expect(host.getByRole('heading', { name: 'Pick a topic' })).toBeVisible({
        timeout: 20_000,
      });
      await expect(guest.getByRole('heading', { name: 'Pick a topic' })).toBeVisible();

      await guest.getByLabel('Your topic').fill('Chat');
      await guest.getByRole('button', { name: 'Propose it' }).click();
      // C1.7 again — "you have voted" is the server's list, so the guest's own
      // ballot is what the host's tally moves on.
      await expect(guest.getByText('your ballot is in')).toBeVisible({ timeout: 20_000 });

      // The host draws rather than waiting out the timer: this journey is meant
      // to be short, and who may draw is the interesting part.
      await expect(guest.getByRole('button', { name: 'Draw now' })).toHaveCount(0);
      await host.getByRole('button', { name: 'Draw now' }).click();

      // Both arrive in the round, through their own generation screen.
      for (const page of [host, guest]) {
        await expect(page.getByRole('article')).toBeVisible({ timeout: 60_000 });
      }

      // C1.1, on both clients, which is what the step asks for in as many words.
      await expectNoSolution(host, 'the host, during the round');
      await expectNoSolution(guest, 'the guest, during the round');
      await expectAttribution(host);
      await expectAttribution(guest);

      // What one player does reaches the other. The live ranking is the cheapest
      // proof that the socket is carrying anything at all.
      await host.getByRole('article').getByRole('button').first().click();
      await expect(guest.getByRole('button', { name: /ranking/i })).toBeVisible();

      // Both submit, which is what ends the round for the room.
      await host.getByRole('button', { name: 'Submit' }).click();
      await guest.getByRole('button', { name: 'Submit' }).click();

      // The debrief, on both. `game_end` is the only message that carries the
      // solution, so this is the first moment either page may hold it.
      for (const page of [host, guest]) {
        await expect(page.getByRole('region', { name: 'Debrief' })).toBeVisible({
          timeout: 30_000,
        });
        await expect(page.getByText(/TRUTHMARKER/).first()).toBeVisible({
          timeout: 20_000,
        });
        // C6.1 — after.
        await expectAttribution(page);
      }
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});

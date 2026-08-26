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
import { expect, test } from '@playwright/test';

import { expectAttribution, expectNoSolution } from './assertions.js';
import { arrive, everyoneSees, host, join, playARound } from './room-journey.js';

test.describe('9.5 — two players, one room', () => {
  test('plays a round together, and neither page holds the solution', async ({
    browser,
  }) => {
    // Two contexts, so two `sessionStorage`s and two session tokens. One context
    // with two tabs is one player with two windows, which is a different test.
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    try {
      const one = await arrive(hostContext);
      const code = await host(one, 'ada');

      const two = await arrive(guestContext);
      await join(two, code, 'bob');

      // The roster is the server's, on both screens: this is the half of the
      // current game that never worked, and the reason 7.3 reads `lobby_update`
      // rather than counting locally.
      await everyoneSees([one, two], 2);

      // C1.7 — the host starts it, and only the host is offered the control.
      await expect(two.getByRole('button', { name: /^Start/ })).toHaveCount(0);

      await playARound(one, [two]);

      // C1.1, on both clients.
      await expectNoSolution(one, 'the host, during the round');
      await expectNoSolution(two, 'the guest, during the round');
      await expectAttribution(one);
      await expectAttribution(two);

      // What one player does reaches the other. The live ranking is the cheapest
      // proof that the socket is carrying anything at all.
      await one.getByRole('article').getByRole('button').first().click();
      await expect(two.getByRole('button', { name: /ranking/i })).toBeVisible();

      // Both submit, which is what ends the round for the room.
      await one.getByRole('button', { name: 'Submit' }).click();
      await two.getByRole('button', { name: 'Submit' }).click();

      // The debrief, on both. `game_end` is the only message that carries the
      // solution, so this is the first moment either page may hold it.
      for (const page of [one, two]) {
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

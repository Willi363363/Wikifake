// A room URL opened by somebody who never saw the entry screen — step P.3.
//
// The one journey no unit suite could have caught, and the file that says why
// is `room-gate.tsx:56`: **every unit suite passes the nickname in as a prop**,
// so none of them ever exercised the piece that reads it. That is how the gate
// shipped keyed on `[code]` alone — `readNickname()` answered null once and,
// since the code never changes, was never asked again. The socket never opened
// and the room rendered a badge reading *en attente* with nothing to act on.
//
// A fresh context rather than a second tab of the host's: this is a stranger
// following a link, not one player with two windows. What matters either way is
// that `sessionStorage` is empty and the browser lands on `/room/<code>`
// without passing `/play`.
import { expect, test } from '@playwright/test';

import { arrive, everyoneSees, host } from './room-journey.js';

test.describe('P.3 — a room link, opened cold', () => {
  test('asks for a nickname, then joins the room it was pointed at', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();

    try {
      const one = await arrive(hostContext);
      const code = await host(one, 'ada');

      const two = await guestContext.newPage();
      await two.goto(`/room/${code}`);

      // The prompt, and the code still in front of the player — a redirect to
      // `/play` would have thrown away the one thing they arrived with.
      await expect(two.getByRole('heading', { name: code })).toBeVisible({
        timeout: 20_000,
      });
      await two.getByLabel('Nickname').fill('bob');
      await two.getByRole('button', { name: 'Join the room' }).click();

      // The socket opened, the server accepted the join, and both screens
      // agree — which is the whole of what the badge could never become.
      await everyoneSees([one, two], 2);
    } finally {
      await hostContext.close();
      await guestContext.close();
    }
  });
});

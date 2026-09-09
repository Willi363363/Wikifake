// Step E.3.3 — a room shows a signed-in player their pseudonym, and no other
// name.
//
// `ticket-handler.test.ts` proves the server substitutes it, and
// `lobby/entry.test.tsx` proves the screen stops asking. Neither can prove the
// thing that matters to a player: that the name in the roster, on the other
// player's screen, is the one on their profile. That needs two browsers, a real
// socket and a real room.
//
// The interesting case is the one nobody would have written from the design:
// a tab that played as a guest first. Its `sessionStorage` still holds the old
// nickname, and if the server did not overrule it that name would follow the
// account into every room it ever joined.
import { expect, test } from '@playwright/test';

import { signUp, someone } from './accounts.js';
import { arrive, everyoneSees, host, join } from './room-journey.js';

test.describe('E.3.3 — the only name a room shows', () => {
  test('shows the pseudonym to everybody, not the nickname in the tab', async ({
    browser,
  }) => {
    const ada = someone('room');
    const account = await browser.newContext();
    const guest = await browser.newContext();

    try {
      const one = await account.newPage();

      // Played as a guest first, in this very tab. `wikifake.nickname` now
      // holds `oldguestname`, and it must not survive signing up.
      await one.goto('/play');
      await one.getByRole('tab', { name: 'Host' }).click();
      await one.getByLabel('Nickname').fill('oldguestname');

      await signUp(one, ada);
      await expect(one).toHaveURL(/\/play$/);

      // The screen tells them their name rather than asking for one.
      await one.getByRole('tab', { name: 'Host' }).click();
      await expect(one.getByLabel('Nickname')).toHaveCount(0);
      await expect(one.getByText(/Playing as/)).toBeVisible();

      const code = await host(one, 'ignored');
      const two = await arrive(guest);
      await join(two, code, 'bob');
      await everyoneSees([one, two], 2);

      // The claim, on the *other* player's screen: what a room shows is the
      // pseudonym, and the guest nickname is nowhere in it.
      await expect(two.getByText(ada.pseudonym).first()).toBeVisible({
        timeout: 30_000,
      });
      await expect(two.getByText('oldguestname')).toHaveCount(0);

      // And on their own, so the chat knows which lines are theirs.
      await expect(one.getByText(ada.pseudonym).first()).toBeVisible();
      await expect(one.getByText('oldguestname')).toHaveCount(0);
    } finally {
      await account.close();
      await guest.close();
    }
  });

  test('still lets a guest choose a name', async ({ browser }) => {
    // A guest has no pseudonym to be shown instead, so nothing about the old
    // screen changes for them — which is the half of this step that is a
    // promise not to break anything.
    const context = await browser.newContext();
    try {
      const page = await arrive(context);
      await page.getByRole('tab', { name: 'Host' }).click();

      await expect(page.getByLabel('Nickname')).toBeVisible();
      await expect(page.getByText(/Playing as/)).toHaveCount(0);

      const code = await host(page, 'solitaryguest');
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
      await expect(page.getByText('solitaryguest').first()).toBeVisible({
        timeout: 30_000,
      });
    } finally {
      await context.close();
    }
  });
});

// Step E.3.2 — an account acquires a pseudonym, and no second one takes it.
//
// `claim.test.ts` drives the handler against a real Postgres and `gate.test.ts`
// drives the redirect, so what is left for a browser is the thing neither can
// hold: the **journey**. Two accounts want one name; the first gets it, the
// second is carried to a screen that asks for another, and comes out of it into
// the game. Nothing here mocks anything.
//
// **No Google journey, and it is not an omission** — the same reason
// `account.spec.ts` gives. A provider flow leaves this origin, and what this
// suite can hold is the state every account arrives from Google in: signed in,
// with no pseudonym. Signing up and losing the claim reaches that state without
// a console, which is why the two paths were deliberately made the same path.
import { expect, test, type Locator, type Page } from '@playwright/test';

import { fill, signUp, someone, type Someone } from './accounts.js';

/**
 * The screen's own alert, as opposed to Next's route announcer.
 *
 * Both carry `role="alert"`; only one of them ever has anything to say.
 */
function said(page: Page): Locator {
  return page.getByRole('alert').filter({ hasText: /\S/ });
}

/**
 * Two accounts that want the same name, and that is the subject.
 *
 * `someone` hands out a pseudonym nobody else will ask for, which is exactly
 * what this suite has to override. The second asks in upper case, so what
 * refuses it is E.3.1's fold rather than a string comparison.
 */
function twoWantingOneName(): { first: Someone; second: Someone } {
  const first = someone('taken');
  return {
    first,
    second: { ...someone('loser'), pseudonym: first.pseudonym.toUpperCase() },
  };
}

test.describe('E.3.2 — the name is claimed, and claimed once', () => {
  test('the second account to want a name is asked for another', async ({
    page,
    browser,
  }) => {
    const { first, second } = twoWantingOneName();
    const wanted = first.pseudonym;

    await signUp(page, first);
    await expect(page).toHaveURL(/\/play$/);
    // The pseudonym is on the profile because a `profile` row exists, not
    // because `user.name` happens to hold it.
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: wanted })).toBeVisible();

    const context = await browser.newContext();
    const other = await context.newPage();
    try {
      await signUp(other, second);

      // Not an error on the sign-up form: the account exists and there is a
      // session, so this is where it goes — the same screen a Google account
      // lands on. The name travels, so the field opens filled in.
      await expect(other).toHaveURL(/\/choose-a-name\?attempted=/);
      await expect(other.getByLabel('Pseudonym', { exact: true })).toHaveValue(
        second.pseudonym,
      );
      // Arriving here is not an error state, so nothing is announced.
      //
      // Filtered by *having text*, and that is not belt-and-braces: Next mounts
      // a `NEXT-ROUTE-ANNOUNCER` with `role="alert"` after every client-side
      // navigation, and this screen is only ever reached by one. A bare
      // `getByRole('alert')` counts the announcer and fails on a page with
      // nothing wrong with it — which is exactly how this line first failed.
      await expect(said(other)).toHaveCount(0);

      // Trying the taken name again is refused here too, with the server's own
      // sentence rather than a guess this screen made.
      await other.getByRole('button', { name: 'Take this name' }).click();
      await expect(said(other)).toHaveText('Another player already goes by that name.');
      await expect(other).toHaveURL(/\/choose-a-name/);

      // And a free one gets them out.
      const free = someone('free').pseudonym;
      await fill(other, 'Pseudonym', free);
      await other.getByRole('button', { name: 'Take this name' }).click();

      await expect(other).toHaveURL(/\/play$/);
      await other.goto('/profile');
      await expect(other.getByRole('heading', { name: free })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('an account with no pseudonym cannot get past the entry screen', async ({
    page,
    browser,
  }) => {
    const { first, second } = twoWantingOneName();
    await signUp(page, first);
    await expect(page).toHaveURL(/\/play$/);

    // Its own context, not another page in this one: two pages in one context
    // share a cookie jar, so the second sign-up would quietly replace the first
    // account's session and the test would be about one account.
    const context = await browser.newContext();
    const other = await context.newPage();
    try {
      // The second account reaches `/choose-a-name` and then tries to walk
      // round it by typing the URL of the screen it was sent from. The gate is
      // on the server, so there is nothing to walk round.
      await signUp(other, second);
      await expect(other).toHaveURL(/\/choose-a-name\?attempted=/);

      await other.goto('/play');

      await expect(other).toHaveURL(/\/choose-a-name$/);
      await expect(
        other.getByRole('heading', { name: 'Choose your name' }),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test('a guest is never asked for one', async ({ page }) => {
    // One of the product effort's three conditions for done: a first-time
    // visitor plays without signing up. A gate that stopped everybody with no
    // pseudonym would end that on the day it shipped.
    await page.goto('/play');

    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByLabel('Wikipedia topic')).toBeVisible();
  });
});

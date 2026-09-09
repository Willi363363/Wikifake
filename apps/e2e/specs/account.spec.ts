// Step E.2 — an account created, used, and left, in a browser.
//
// `account.test.tsx` proves the screens call the right things with the right
// arguments, against a mocked client. It cannot prove the one thing that
// matters: that an account is **written down**. A session is a signed cookie
// over a row in Postgres, and every part of that — the handler, the adapter,
// the schema phase 2 laid down for Better Auth's shapes — is outside the reach
// of a render.
//
// So this is the round trip: create an account, be somewhere as that account,
// come back to it in a new context with the password. Nothing here mocks
// anything.
//
// **No OAuth journey, and it is not an omission.** A provider flow leaves this
// origin for Google's, which needs a real console, a real consent screen and a
// registered redirect URI — step E.1, and a person. What this suite can hold is
// that no button is offered when nothing is configured, which is the state
// every run of it is in.
import { expect, test } from '@playwright/test';

import { fill, said, someone } from './accounts.js';

test.describe('E.2 — an account, end to end', () => {
  test('is created, and survives being come back to', async ({ page, browser }) => {
    const ada = someone();

    await page.goto('/sign-up');
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();

    await fill(page, 'Email', ada.email);
    await fill(page, 'Pseudonym', ada.pseudonym);
    await fill(page, 'Password', ada.password);
    await page.getByRole('button', { name: 'Create the account' }).click();

    // Landing on the entry screen is what says a session exists: the form only
    // navigates once Better Auth has answered without an error.
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByLabel('Wikipedia topic')).toBeVisible();

    // A second context: a new browser with none of the first's cookies, so
    // what is being proved is the row in Postgres and not the tab.
    const second = await browser.newContext();
    const returning = await second.newPage();
    try {
      await returning.goto('/sign-in');
      await fill(returning, 'Email', ada.email);
      await fill(returning, 'Password', ada.password);
      await returning.getByRole('button', { name: 'Sign in' }).click();

      await expect(returning).toHaveURL(/\/play$/);
    } finally {
      await second.close();
    }
  });

  test('refuses the wrong password, and says so without saying which', async ({
    page,
  }) => {
    const ada = someone();

    await page.goto('/sign-up');
    await fill(page, 'Email', ada.email);
    await fill(page, 'Pseudonym', ada.pseudonym);
    await fill(page, 'Password', ada.password);
    await page.getByRole('button', { name: 'Create the account' }).click();
    await expect(page).toHaveURL(/\/play$/);

    await page.goto('/sign-in');
    await fill(page, 'Email', ada.email);
    await fill(page, 'Password', 'not-the-right-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Announced, not merely displayed — and the page has not moved.
    await expect(said(page)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('refuses a second account on one address', async ({ page }) => {
    const ada = someone();

    for (const attempt of [1, 2]) {
      await page.goto('/sign-up');
      await fill(page, 'Email', ada.email);
      await fill(page, 'Pseudonym', ada.pseudonym);
      await fill(page, 'Password', ada.password);
      await page.getByRole('button', { name: 'Create the account' }).click();

      if (attempt === 1) {
        await expect(page).toHaveURL(/\/play$/);
      } else {
        // Better Auth's own sentence, shown verbatim. What is asserted is that
        // the screen shows *something* and stays put: pinning the library's
        // wording here would be pinning a string this repository does not own.
        await expect(said(page)).toBeVisible();
        await expect(page).toHaveURL(/\/sign-up$/);
      }
    }
  });
});

test.describe('E.2 — the screens themselves', () => {
  test('offer no provider when the deployment configures none', async ({ page }) => {
    // The harness sets no OAuth credentials, which is also a developer's normal
    // state. A heading over no buttons is the failure shape, so the heading is
    // what is checked for.
    await page.goto('/sign-in');

    await expect(page.getByText(/continue with/i)).toHaveCount(0);
  });

  test('can be walked past without an account', async ({ page }) => {
    // One of the product effort's three conditions for "done": a first-time
    // visitor plays without signing up. A sign-in page with no exit is how that
    // quietly stops being true.
    await page.goto('/sign-in');
    await page.getByRole('link', { name: 'Play without an account' }).click();

    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByLabel('Wikipedia topic')).toBeVisible();
  });

  test('are reachable in French, and keep their prefix', async ({ page }) => {
    await page.goto('/fr/sign-up');

    await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible();
    await expect(page.getByLabel('Pseudonyme', { exact: true })).toBeVisible();
    // The link between the two screens has to carry the locale, or a French
    // player is dropped into English by clicking "Se connecter".
    await page.getByRole('link', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/fr\/sign-in$/);
  });

  test('are kept out of an index', async ({ page }) => {
    // Not content. `robots.ts` keeps crawlers away from the screens that render
    // falsified articles; this is the other kind of page a crawler should not
    // spend a visit on, and per-page is cheaper than growing that list.
    await page.goto('/sign-in');

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
  });
});

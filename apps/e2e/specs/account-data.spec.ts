// Step E.7 — an account takes its data out, and then takes itself away.
//
// `packages/db`'s `account.test.ts` holds what the delete does to rows and
// `account/data.test.ts` holds who is allowed to ask. Neither can hold the
// thing a player experiences: that the export is a file their browser saves,
// and that after the delete they are signed out and the account really is gone
// — proved by trying to sign back in with the password that worked a moment
// before.
//
// The round played first is not decoration. An account with no rounds deletes
// through a path that never touches `participant`, which is exactly the
// constraint this step exists for: a solo round is what makes the naive delete
// abort.
import { expect, test } from '@playwright/test';

import { fill, signUp, someone } from './accounts.js';

test.describe('E.7 — your data, and its way out', () => {
  test('is exported as a file the browser saves', async ({ page }) => {
    const ada = someone('data');
    await signUp(page, ada);
    await expect(page).toHaveURL(/\/play$/);
    await page.goto('/profile');

    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Download my data' }).click();
    const saved = await download;

    // A downloads folder is not a private place, so the name carries no
    // address and no id.
    expect(saved.suggestedFilename()).toBe('wikifake-account.json');
    expect(saved.suggestedFilename()).not.toContain(ada.email);

    const stream = await saved.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const held = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      account: { email: string };
      profile: { pseudonym: string };
    };

    expect(held.account.email).toBe(ada.email);
    expect(held.profile.pseudonym).toBe(ada.pseudonym);
    // Nothing that could be used to sign in. The right of access is to the
    // data, and a hashed password is not it.
    expect(JSON.stringify(held)).not.toContain('password');
  });

  test('is deleted, and the password stops working', async ({ page, browser }) => {
    const ada = someone('data');
    await signUp(page, ada);
    await expect(page).toHaveURL(/\/play$/);

    // A solo round first: an account with none deletes through a path that
    // never touches `participant`, and `participant` is where the naive delete
    // aborts.
    await page.getByLabel('Wikipedia topic').fill('Chat');
    await page.getByRole('button', { name: 'Play solo' }).click();
    await expect(page.getByRole('article').first()).toBeVisible({ timeout: 60_000 });

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Delete my account' }).click();

    // The confirmation is their own name, which a mis-click does not type.
    await fill(page, `Type ${ada.pseudonym} to confirm`, ada.pseudonym);
    await page.getByRole('button', { name: 'Delete it' }).click();

    // Signed out and sent home, because there is no profile any more.
    await expect(page).toHaveURL(/\/$/);

    // The claim, in a browser that never held the session: the password that
    // worked a moment ago now matches no account.
    const second = await browser.newContext();
    try {
      const returning = await second.newPage();
      await returning.goto('/sign-in');
      await fill(returning, 'Email', ada.email);
      await fill(returning, 'Password', ada.password);
      await returning.getByRole('button', { name: 'Sign in' }).click();

      await expect(returning.locator('form').getByRole('alert')).toBeVisible();
      await expect(returning).toHaveURL(/\/sign-in$/);
    } finally {
      await second.close();
    }
  });

  test('frees the pseudonym for somebody else', async ({ page, browser }) => {
    const ada = someone('data');
    await signUp(page, ada);
    // Waited for, not assumed: `signUp` clicks and returns, and sign-up is two
    // round trips since E.3.2 — the account, then the pseudonym. Going to
    // `/profile` before the second lands is a redirect to `/sign-in`.
    await expect(page).toHaveURL(/\/play$/);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Delete my account' }).click();
    await fill(page, `Type ${ada.pseudonym} to confirm`, ada.pseudonym);
    await page.getByRole('button', { name: 'Delete it' }).click();
    await expect(page).toHaveURL(/\/$/);

    // A deleted account holds nothing, including a name — which is the half of
    // E.3.1's uniqueness that only a deletion can prove.
    const second = await browser.newContext();
    try {
      const other = await second.newPage();
      await signUp(other, { ...someone('heir'), pseudonym: ada.pseudonym });

      await expect(other).toHaveURL(/\/play$/);
    } finally {
      await second.close();
    }
  });
});

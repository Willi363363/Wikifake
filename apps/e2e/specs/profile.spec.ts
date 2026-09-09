// Step E.5 — the profile, and the one thing no unit test can reach.
//
// `profile.test.tsx` proves the screen formats a row. `stats.test.ts` proves
// the row is right for a sequence of rounds fed to it directly. **Neither
// proves the two are connected**: that playing a real game through the real
// routes moves the real numbers on the real screen.
//
// That connection runs through four things a render cannot see — the session
// cookie, `createGame`'s increment, `recordSubmission`'s transaction, and the
// server component's own query — and each of them is a place the wire could be
// cut without a single test going red.
//
// So this plays a round. Once.
import { expect, test, type Page } from '@playwright/test';

import { someone, type Someone } from './accounts.js';

async function signUp(page: Page, who: Someone): Promise<void> {
  await page.goto('/sign-up');
  await page.getByLabel('Email', { exact: true }).fill(who.email);
  await page.getByLabel('Pseudonym', { exact: true }).fill(who.pseudonym);
  await page.getByLabel('Password', { exact: true }).fill(who.password);
  await page.getByRole('button', { name: 'Create the account' }).click();
  await expect(page).toHaveURL(/\/play$/);
}

/** The solo journey of `solo.spec.ts`, in as few steps as a round allows. */
async function playARound(page: Page, marks: number): Promise<void> {
  await page.goto('/play');
  await page.getByLabel('Wikipedia topic').fill('Chat');
  await page.getByRole('button', { name: 'Play solo' }).click();

  const article = page.getByRole('article');
  await expect(article).toBeVisible({ timeout: 30_000 });

  const paragraphs = article.getByRole('button');
  for (let index = 0; index < marks; index += 1) {
    await paragraphs.nth(index).click();
  }

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('region', { name: 'Debrief' })).toBeVisible();
  await expect(page.getByText(/points$/)).toBeVisible({ timeout: 20_000 });
}

test.describe('E.5 — the profile', () => {
  test('starts empty, and counts a round that was actually played', async ({ page }) => {
    const ada = someone();
    await signUp(page, ada);

    // Nothing yet, and it says so as an invitation rather than as a row of
    // zeroes — a new account and an account that lost every round are not the
    // same thing and must not look alike.
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: ada.pseudonym })).toBeVisible();
    await expect(page.getByText(/No rounds yet/)).toBeVisible();

    await playARound(page, 3);

    await page.goto('/profile');
    await expect(page.getByText(/No rounds yet/)).toHaveCount(0);

    // One round finished and none abandoned — the increment at `createGame`
    // and the one inside `recordSubmission`'s transaction, both landed.
    const finished = page.locator('dl div', { hasText: 'Rounds finished' });
    await expect(finished).toContainText('1');
    const abandoned = page.locator('dl div', { hasText: 'Left unfinished' });
    await expect(abandoned).toContainText('0');

    // And the breakdown, which is the sentence that proves the round's own
    // outcome reached the row rather than a counter being bumped by one.
    await expect(
      page.getByText(/found, .* missed, .* true paragraphs marked/),
    ).toBeVisible();
  });

  test('counts a round left unfinished as left unfinished', async ({ page }) => {
    // The reason `gamesPlayed` is incremented at the start. Counted only on
    // submission, "abandoned" would be a column that is always zero — and the
    // player who closes the tab on a hard article would look like one who never
    // opened it.
    const ada = someone();
    await signUp(page, ada);

    await page.goto('/play');
    await page.getByLabel('Wikipedia topic').fill('Chat');
    await page.getByRole('button', { name: 'Play solo' }).click();
    await expect(page.getByRole('article')).toBeVisible({ timeout: 30_000 });

    // Walk away. No submission, and therefore no grading.
    await page.goto('/profile');

    await expect(page.locator('dl div', { hasText: 'Rounds finished' })).toContainText(
      '0',
    );
    await expect(page.locator('dl div', { hasText: 'Left unfinished' })).toContainText(
      '1',
    );
  });
});

test.describe('E.5 — finding it', () => {
  test('is one link from the screen every player passes through', async ({ page }) => {
    // A profile nothing points at is a profile nobody opens. The entry screen
    // is where a player lands after signing in, so it is where the link is.
    const ada = someone();
    await signUp(page, ada);

    await page.goto('/play');
    await page.getByRole('link', { name: 'Your profile' }).click();

    await expect(page.getByRole('heading', { name: ada.pseudonym })).toBeVisible();
  });

  test('offers an account to somebody who has none, not a profile', async ({ page }) => {
    // Decided on the server, so it does not flicker after hydration — and a
    // guest is offered the account rather than the profile they do not have.
    await page.goto('/play');

    await expect(
      page.getByRole('link', { name: 'Create an account, or sign in' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Your profile' })).toHaveCount(0);
  });
});

test.describe('E.5 — who the profile is for', () => {
  test('sends somebody with no session to sign in', async ({ page }) => {
    await page.goto('/profile');

    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('sends a guest to sign up rather than showing them an empty one', async ({
    page,
  }) => {
    // A guest has a real `user` row — that is what makes the games they play
    // follow them into an account — but no profile to show. Sign-up is the
    // screen that turns what they have already played into something with a
    // name on it.
    await page.goto('/play');
    await page.getByLabel('Wikipedia topic').fill('Chat');
    await page.getByRole('button', { name: 'Play solo' }).click();
    await expect(page.getByRole('article')).toBeVisible({ timeout: 30_000 });

    await page.goto('/profile');

    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test('lets a player sign out, and stops being theirs afterwards', async ({ page }) => {
    const ada = someone();
    await signUp(page, ada);

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Sign out' }).click();

    await expect(page).toHaveURL(/\/(en)?$|\/$/);
    // The session is the cookie, so this is the assertion that it is gone: the
    // profile is no longer reachable and the redirect proves it server-side.
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

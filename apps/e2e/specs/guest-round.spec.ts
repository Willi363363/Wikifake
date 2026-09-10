// Step E.6 — a guest plays a round, signs up, and still has it.
//
// The mechanism has existed since 4.3 and is proved at two levels already:
// `apps/web/src/auth/guests.test.ts` drives the linking through
// `auth.handler` over a fixture game, and `multiplayer-profile.spec.ts` walks
// the whole of it in a browser **for a room**. Neither is this.
//
// What is missing is the ordinary path — the one most first-time players take:
// solo, with no account, from the entry screen. It runs through the guest
// `identify()` mints on `POST /api/game/start`, the `participant` row it opens,
// `recordSubmission`'s transaction, the invitation on the debrief, the sign-up
// that fires `onLinkAccount`, `attachGuestRecords` moving the rows,
// `recomputePlayerStats` rebuilding the aggregate, the pseudonym claim that
// follows the sign-up, and the server component that reads the row back.
//
// **And the round it asserts is the round that was played**, not a count that
// happens to be one. The stub falsifies all three paragraphs and the journey
// marks two of them, so the profile must afterwards read *two found, one missed,
// nothing wrongly marked* — this round's own outcome, and no other round's. A
// count of one is satisfied by any round.
//
// The score is deliberately not the assertion: it carries a time bonus, so it is
// a different number on a loaded machine than on an idle one.
import { expect, test, type Page } from '@playwright/test';

import { fill, signUp, someone } from './accounts.js';

/**
 * A whole solo round, as a player with no account plays it.
 *
 * **Two marks out of three falsifications**, which is what makes the profile's
 * breakdown afterwards specific to this round: two found and one missed is a
 * sentence an empty submission and a perfect one would both fail.
 */
async function playSolo(page: Page): Promise<void> {
  await page.goto('/play');
  await page.getByLabel('Wikipedia topic').fill('Chat');
  await page.getByRole('button', { name: 'Play solo' }).click();

  const article = page.getByRole('article');
  await expect(article).toBeVisible({ timeout: 30_000 });

  const paragraphs = article.getByRole('button');
  await paragraphs.nth(0).click();
  await paragraphs.nth(1).click();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('region', { name: 'Debrief' })).toBeVisible();

  // The debrief holds everything back until its ranking has landed, the
  // invitation included, so the wait is for the reveal rather than for a
  // duration. `/points$/` is what `solo.spec.ts` waits on too.
  await expect(page.getByText(/points$/)).toBeVisible({ timeout: 20_000 });
}

/** One figure on the profile, by the name above it. */
function figure(page: Page, label: string) {
  return page.locator('dl div', { hasText: label });
}

test.describe('E.6 — a guest keeps the round they played', () => {
  test('carries a solo round onto the account created afterwards', async ({ page }) => {
    const ada = someone('guest');

    // No sign-in of any kind first. This is the path a first-time visitor
    // takes, and one of this effort's three conditions for done is that it
    // works at all.
    await playSolo(page);

    // The invitation of E.6. Before this step the mechanism worked and nothing
    // said so: a guest who closed the tab here lost the round to a sentence
    // nobody had written.
    await expect(page.getByRole('region', { name: 'Keep this round' })).toBeVisible();
    await page.getByRole('link', { name: 'Keep my rounds' }).click();
    await expect(page).toHaveURL(/\/sign-up$/);

    // Filled here rather than through `signUp`, which starts with its own
    // `goto`. The point of this journey is that the player never leaves the
    // path the invitation put them on.
    await fill(page, 'Email', ada.email);
    await fill(page, 'Pseudonym', ada.pseudonym);
    await fill(page, 'Password', ada.password);
    await page.getByRole('button', { name: 'Create the account' }).click();
    await expect(page).toHaveURL(/\/play$/);

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: ada.pseudonym })).toBeVisible();

    // The claim, in three parts: the round is there, it is counted as finished
    // rather than abandoned, and the numbers are *this* round's.
    await expect(page.getByText(/No rounds yet/)).toHaveCount(0);
    await expect(figure(page, 'Rounds finished')).toContainText('1');
    await expect(figure(page, 'Left unfinished')).toContainText('0');
    await expect(
      page.getByText('2 found, 1 missed, 0 true paragraphs marked.'),
    ).toBeVisible();
  });

  test('says nothing about keeping a round to a player who already has an account', async ({
    page,
  }) => {
    /*
     * The half that would be embarrassing rather than merely missing.
     *
     * `keep-round.test.tsx` holds the same rule over four session states, and
     * this is the one of them that runs through a real cookie: an account's
     * round is already theirs, and telling them it belongs to nobody would be
     * false on the one screen where they can see what they just earned.
     */
    const bob = someone('account');
    await signUp(page, bob);
    await expect(page).toHaveURL(/\/play$/);

    await playSolo(page);

    await expect(page.getByRole('region', { name: 'Keep this round' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Keep my rounds' })).toHaveCount(0);
  });
});

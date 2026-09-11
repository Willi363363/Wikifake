// Step F.7 — the quests screen, in a browser.
//
// The whole of track F, end to end and through every layer it built: the
// catalogue's rules, the deterministic draw, the `quest_assignment` row the read
// path writes when the cron never ran, the progress derived from `participant`
// rows, the claim's conditional update, and the screen that shows all of it.
// Seven steps, and this is the only test that touches all seven.
//
// **Four rounds, and the number is not arbitrary.** The daily set is three of
// five rules drawn per player, so which rules a given account gets is decided by
// its own identifier — random here, since the email is. What is *not* random is
// that four perfect rounds meet the maximum target of four of the five rules:
// finish four (max 4), twelve falsifications (max 12, three per round), a round
// with no hint (max 2), a round marking nothing true (max 2). Only
// `DAILY_SCORE_POINTS` is not guaranteed by count alone — and a set holds three
// rules, so at least two of them are certainly complete.
//
// That is what makes "at least one Claim button" a fact rather than a hope.
import { expect, test, type Page } from '@playwright/test';

import { signUp, someone } from './accounts.js';

/** A perfect round: every falsified paragraph marked, no hint bought. */
async function playAPerfectRound(page: Page): Promise<void> {
  await page.goto('/play');
  await page.getByLabel('Wikipedia topic').fill('Chat');
  await page.getByRole('button', { name: 'Play solo' }).click();

  const article = page.getByRole('article');
  await expect(article).toBeVisible({ timeout: 30_000 });

  // All three, which the stub falsifies all of — so three found and nothing
  // wrongly marked, which is `isPerfectRound` and the `noHints` qualifier both.
  const paragraphs = article.getByRole('button');
  const count = await paragraphs.count();
  for (let index = 0; index < count; index += 1) {
    await paragraphs.nth(index).click();
  }

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('region', { name: 'Debrief' })).toBeVisible();
  await expect(page.getByText(/points$/)).toBeVisible({ timeout: 20_000 });
}

test.describe('F.7 — the quests screen', () => {
  test('shows a set, counts a round against it, and pays a claim once', async ({
    page,
  }) => {
    const ada = someone('quests');
    await signUp(page, ada);
    await expect(page).toHaveURL(/\/play$/);

    // Nothing has run for this account: no cron, no assignment. The read path
    // is what makes the screen work anyway, which is F.5's guarantee.
    await page.goto('/quests');
    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible();

    // Three daily and two weekly, drawn — and nothing claimable yet.
    await expect(page.getByRole('progressbar')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Claim' })).toHaveCount(0);
    await expect(page.getByText('Keep playing').first()).toBeVisible();

    for (let round = 0; round < 4; round += 1) {
      await playAPerfectRound(page);
    }

    await page.goto('/quests');

    // The progress is derived, so it moved without anything having been written
    // when the rounds were played — F.3's re-cut, from the visible end.
    const claimable = page.getByRole('button', { name: 'Claim' });
    expect(await claimable.count()).toBeGreaterThan(0);

    await claimable.first().click();

    // The row is re-read rather than rewritten in the browser, so "Claimed" is
    // the database's answer arriving through a refresh.
    await expect(page.getByText('Claimed').first()).toBeVisible();
    // And the coins are counted, with the honest sentence beside them.
    await expect(page.getByText(/the shop is still being built/)).toBeVisible();
  });

  test('sends a guest to sign up rather than giving them a quest', async ({ page }) => {
    /*
     * A guest holds a real `user` row — 4.3's design — so nothing stops the read
     * path drawing them a set. The page refuses anyway, and the reason is
     * `quest_assignment.user_id`: it cascades, and the anonymous plugin deletes
     * that row the moment they sign up. `attachGuestRecords` moves the rounds
     * they played; nothing moves an assignment.
     *
     * So a quest given to a guest is a promise that disappears — the same
     * refusal E.3.2 made about spending a pseudonym on an identity that is about
     * to be deleted.
     */
    await page.goto('/play');
    await page.getByLabel('Wikipedia topic').fill('Chat');
    await page.getByRole('button', { name: 'Play solo' }).click();
    await expect(page.getByRole('article')).toBeVisible({ timeout: 30_000 });

    await page.goto('/quests');

    await expect(page).toHaveURL(/\/sign-up$/);
  });

  test('sends somebody with no session to sign in', async ({ page }) => {
    await page.goto('/quests');

    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('is one link from the profile, which is one from the entry screen', async ({
    page,
  }) => {
    // F.7's reachability, walked rather than asserted about: a screen nothing
    // points at is a screen nobody opens.
    const ada = someone('quests');
    await signUp(page, ada);
    await expect(page).toHaveURL(/\/play$/);

    await page.getByRole('link', { name: 'Your profile' }).click();
    await page.getByRole('link', { name: 'Your quests' }).click();

    await expect(page.getByRole('heading', { name: 'Quests' })).toBeVisible();
  });
});

// Step 11.8 — an unknown URL, in a browser.
//
// `errors.locale.test.tsx` proves the components render the right words in both
// locales. It cannot prove that Next *reaches* them: a `not-found.tsx` in the
// wrong directory, or a proxy that rewrites before the router sees the path,
// renders the framework's own English default while every unit test stays green.
// That is the same argument this repository made against inferring a media query
// from a stylesheet, and it applies here.
//
// So: a real request to a real build, and the status code as well as the words —
// a 404 page served with 200 is a soft 404, which a crawler indexes and a monitor
// never notices.
import { expect, test } from '@playwright/test';

const UNKNOWN = '/this-page-does-not-exist-and-never-did';

test.describe('11.8 — an unknown URL', () => {
  test('answers 404 and shows the WikiFake page, not the framework default', async ({
    page,
  }) => {
    const response = await page.goto(UNKNOWN);

    expect(response?.status()).toBe(404);

    // The words are the catalogue's. Next's built-in page says "404" and "This
    // page could not be found", and neither sentence is ours.
    await expect(
      page.getByRole('heading', { name: 'That page is not here' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Back to the front door' }),
    ).toBeVisible();
    await expect(page.getByText('This page could not be found')).toHaveCount(0);
  });

  // The claim of the whole step, and the only one a French player can check:
  // before it, this URL answered Next's English default whatever the locale.
  test('answers in French under the French prefix', async ({ page }) => {
    const response = await page.goto(`/fr${UNKNOWN}`);

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: "Cette page n'est pas là" }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: "Revenir à l'accueil" })).toBeVisible();
    await expect(page.getByText('That page is not here')).toHaveCount(0);
  });

  test('leads back to somewhere real', async ({ page }) => {
    await page.goto(UNKNOWN);
    await page.getByRole('link', { name: 'Start a round' }).click();

    // The entry screen of step 7.2 — proof the way out is a working route and
    // not a link to another 404.
    await expect(page.getByLabel('Wikipedia topic')).toBeVisible();
  });
});

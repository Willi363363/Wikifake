// The test that tests the test.
//
// The step's second criterion is that the job **fails** if a field of the
// solution is leaked into the start payload. A negative assertion is trivially
// true until something proves it can be false, and "we looked and it was fine"
// is not that proof.
//
// So the payload is leaked, here, on purpose: the browser intercepts
// `/api/game/start` and rewrites the article so it carries the markers a real
// leak would carry. The assertion must then fail — and the test passes because
// it did.
//
// What this proves, exactly: the scan sees solution values anywhere in the
// document, including places no component names. What it does not prove is that
// a *specific* extra field would reach the page — the client decodes the
// response against `startGameResponse`, and zod strips what the schema does not
// declare, which is a second barrier and worth knowing about. The leak modelled
// here is the one that gets past it: values inside fields the client does
// render, which is C1.1's "no original text" to the letter.
import { expect, test } from '@playwright/test';

import { expectNoSolution, KEPT_BACK } from './assertions.js';

test.describe('9.5 — the negative assertion has teeth', () => {
  test('fails when the start payload carries the solution', async ({ page }) => {
    await page.route('**/api/game/start', async (route) => {
      const answer = await route.fetch();
      const body = (await answer.json()) as { paragraphs: string[] };

      // A server that shipped the untouched text alongside the falsified one.
      // This is the leak: not a field with a telling name, a value in a field
      // that is rendered.
      await route.fulfill({
        response: answer,
        json: {
          ...body,
          paragraphs: body.paragraphs.map(
            (text, at) => `${text} ORIGINALMARKER-${String(at + 1)}`,
          ),
        },
      });
    });

    await page.goto('/play');
    await page.getByLabel('Wikipedia topic').fill('Chat');
    await page.getByRole('button', { name: 'Play solo' }).click();
    await expect(page.getByRole('article')).toBeVisible({ timeout: 30_000 });

    // The assertion the other two specs make, against a page that leaks.
    await expect(
      expectNoSolution(page, 'a deliberately leaking payload'),
    ).rejects.toThrow();
  });

  test('is looking for markers that exist', async ({ page }) => {
    // A scan whose markers no longer appear in the fixture would pass on every
    // page in the world. The debrief is where they are allowed to be, so it is
    // where their existence is confirmed.
    await page.goto('/play');
    await page.getByLabel('Wikipedia topic').fill('Chat');
    await page.getByRole('button', { name: 'Play solo' }).click();
    await expect(page.getByRole('article')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByText(/points$/)).toBeVisible({ timeout: 20_000 });
    const shown = await page.content();
    expect(KEPT_BACK.some((marker) => shown.includes(marker))).toBe(true);
  });
});

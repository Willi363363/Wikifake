// The solo journey, in a browser.
//
// Step 7.8 asked for this and was cut back, because the harness belongs here.
// This is that run: a topic, a wait, an article, a mark, a score — through the
// real routes, the real database, the real build. What is not real is the two
// upstreams, which answer from `@wikifake/article/testing` on a local port.
import { expect, test } from '@playwright/test';

import { expectAttribution, expectNoSolution } from './assertions.js';

test.describe('9.5 — a solo game, end to end', () => {
  test('plays from a topic to a score, and leaks nothing on the way', async ({
    page,
  }) => {
    await page.goto('/play');

    // The entry screen of 7.2. Solo asks for no nickname: there is no room and
    // no socket, and the round is played by whoever is holding the browser.
    await page.getByLabel('Wikipedia topic').fill('Chat');
    await page.getByRole('button', { name: 'Play solo' }).click();

    // The generation screen of 7.5, which finishes itself.
    await expect(
      page.getByRole('progressbar', { name: 'Generating the round' }),
    ).toBeVisible();

    // The article. Three paragraphs, all three falsified by the stub, so the
    // count says three and says nothing else about them.
    const article = page.getByRole('article');
    await expect(article).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('3 altered')).toBeVisible();

    // C1.1 — the assertion this whole harness exists for.
    await expectNoSolution(page, 'during the round');
    // C6.1 — during.
    await expectAttribution(page);

    // The central gesture, from a keyboard: 8.1's criterion, in a real browser
    // where a `<span onClick>` would simply never receive the key.
    const paragraphs = article.getByRole('button');
    await paragraphs.first().focus();
    await page.keyboard.press('Enter');
    await expect(paragraphs.first()).toHaveAttribute('aria-pressed', 'true');

    // Still nothing, with a paragraph marked.
    await expectNoSolution(page, 'with a paragraph marked');

    await page.getByRole('button', { name: 'Submit' }).click();

    // The debrief of 8.7, which reveals when its ranking says so. The solution
    // is allowed here, and this is the first moment it is.
    await expect(page.getByRole('region', { name: 'Debrief' })).toBeVisible();
    await expect(page.getByText(/points$/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/TRUTHMARKER/).first()).toBeVisible();

    // C6.1 — and after. The current debrief is a full-screen modal over the
    // article, so this is the half that could not have passed before 8.7.
    await expectAttribution(page);
  });

  test('says so when the topic is one nothing answers for', async ({ page }) => {
    // The stub answers every search with the same fixture, so this is the
    // client's own guard rather than the server's: a topic the schema refuses
    // never leaves the browser.
    await page.goto(`/solo?topic=${'x'.repeat(200)}`);
    // By text, not by role: Next's own route announcer is an `alert` too, and a
    // strict locator that matches both is a locator that matches neither.
    await expect(page.getByText('not one we can look up')).toBeVisible();
  });
});

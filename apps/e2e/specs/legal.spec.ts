// Step J.3 — the two documents, reached the way a person reaches them.
//
// `legal.test.tsx` renders them and holds their sections, their address and
// their licence. What it cannot say is the only thing that matters to somebody
// who wants to know what is stored about them: **that they can get there**.
//
// A policy is reached from wherever the reader happens to be — which in this
// application is a footer that also carries the language switch — and it has to
// answer in the language they are reading. Both halves are journeys, not
// renders, so both are here.
import { expect, test } from '@playwright/test';

// J.5 added the third document to this journey rather than a spec of its own:
// what is asserted is the same claim about the same footer, and a second file
// would be a second place to remember when a fourth arrives.
test.describe('J.3 and J.5 — the documents are reachable', () => {
  test('the front door links the privacy policy, and it answers', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Privacy' }).click();

    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();

    // The section a reader arrives for. Named rather than counted: "the page
    // rendered" is true of a page that lost the paragraph about erasure.
    await expect(page.getByRole('heading', { name: 'Your rights' })).toBeVisible();
  });

  test('and the terms, from the same footer', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Terms' }).click();

    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Terms' })).toBeVisible();

    // The one sentence the game legally needs on this page: the articles are
    // Wikipedia's, under a licence, and this project is not theirs.
    await expect(page.getByRole('link', { name: 'CC BY-SA 4.0' })).toBeVisible();
  });

  test('a French reader gets the French page, at the French URL', async ({ page }) => {
    await page.goto('/fr');

    await page.getByRole('link', { name: 'Confidentialité' }).click();

    // The locale-aware `Link`, proved: `next/link` would have dropped a French
    // reader into `/privacy` and served them an English policy.
    await expect(page).toHaveURL(/\/fr\/privacy$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Confidentialité' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vos droits' })).toBeVisible();
  });

  test('both are offered from a game screen, not only from the landing', async ({
    page,
  }) => {
    // The reason the links are in the shared footer rather than at the bottom
    // of the landing: somebody who wants to know what is stored about them is
    // most likely to want it while they are playing.
    await page.goto('/play');

    await expect(page.getByRole('link', { name: 'Privacy' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Terms' })).toBeVisible();
  });

  test('the FAQ is one click away, and answers as data too', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Questions' }).click();

    await expect(page).toHaveURL(/\/faq$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Questions' }),
    ).toBeVisible();

    // The answer a reader of a game about false facts most needs, and the one
    // this page puts second on purpose.
    await expect(
      page.getByRole('heading', { name: 'Can I trust what I read in a round?' }),
    ).toBeVisible();

    // The structured data, parsed out of the served document rather than
    // rendered: it is emitted for machines, and this is the only place that
    // reads it the way one would.
    const block = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(block ?? '') as { '@type': string; mainEntity: unknown[] };
    expect(data['@type']).toBe('FAQPage');
    expect(data.mainEntity.length).toBeGreaterThan(5);
  });

  test('a crawler is allowed to keep them', async ({ page }) => {
    for (const path of ['/privacy', '/terms', '/faq']) {
      await page.goto(path);

      // Every other screen this effort added says `noindex`. These three must
      // not: a document nobody can find answers nobody.
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(
        0,
      );
    }
  });
});

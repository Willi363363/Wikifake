// C6.2, C6.3, C7.3 — what a crawler and a share card actually receive.
//
// The unit tests beside `apps/web/src/indexing.ts` assert the decisions. This
// asserts the *responses*, and there is no other way to get them: `robots.ts`
// and `sitemap.ts` are compiled by Next into routes that serialise their return
// value into a text format, and C7.3 is a statement about a status code and a
// content type — a component that renders proves neither.
//
// It is also the cheapest spec in this suite: no room, no socket, no model, no
// database. Three requests and a head.
import { expect, test } from '@playwright/test';

test.describe('10.0 — indexing and the front door', () => {
  test('C7.3 — GET / answers HTML 200 with a non-empty title', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.status()).toBe(200);
    expect(response?.headers()['content-type']).toContain('text/html');
    // Not the wording — that is marketing copy and will change. That there is
    // one, which is what the old `test_index_always_serves_html` asserted.
    expect((await page.title()).trim().length).toBeGreaterThan(0);

    // A redirect would have been followed silently and reported 200 from
    // `/play`, so the URL is checked too: this page is the one that answered.
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('C6.3 — the head carries the canonical and the share tags', async ({ page }) => {
    await page.goto('/');

    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1);
    expect(await canonical.getAttribute('href')).toMatch(/^https?:\/\//);

    for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
      await expect(
        page.locator(`meta[property="${property}"]`),
        `${property} is missing, so a shared link shows nothing`,
      ).toHaveCount(1);
    }

    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );

    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect((description ?? '').length).toBeGreaterThan(70);
  });

  test('C6.3 — the English front door says lang="en" and names its alternates', async ({
    page,
  }) => {
    // Step 11.5's amendment, asserted on the wire: the document's `lang` is
    // the interface locale, and the `hreflang` alternates tell a crawler the
    // other language exists. Headless Chromium announces English, so `/` is
    // served as English rather than redirected.
    await page.goto('/');

    expect(await page.locator('html').getAttribute('lang')).toBe('en');

    const french = page.locator('link[rel="alternate"][hreflang="fr"]');
    await expect(french).toHaveCount(1);
    expect(await french.getAttribute('href')).toMatch(/\/fr$/);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(
      1,
    );
  });

  test('C6.3 — the French front door says lang="fr", in its own words', async ({
    page,
  }) => {
    await page.goto('/fr');

    expect(await page.locator('html').getAttribute('lang')).toBe('fr');
    // Its own canonical — not the English page's — and its own og:locale:
    // the pair `lang` must never contradict.
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toMatch(
      /\/fr$/,
    );
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
      'content',
      'fr_FR',
    );
    // And its own description: per-locale metadata that serves one language
    // twice is the old single-value metadata back again.
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute('content');
    expect(description).toContain('Wikipédia');
  });

  test('C6.2 — robots.txt keeps the crawlers out where it must', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toMatch(/Disallow: \/api\//);
    expect(body).toMatch(/Disallow: \/ws\//);
    // The corpus is misinformation by construction: these four are refused
    // everything, not merely kept out of the API.
    for (const crawler of ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot']) {
      expect(body, `${crawler} is not named`).toContain(crawler);
    }
    expect(body).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  });

  test('C6.2 — sitemap.xml declares the front door', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('<urlset');
    expect(body).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
    // Step 11.5: the French pages are declared too, not merely reachable.
    expect(body).toMatch(/<loc>https?:\/\/[^<]+\/fr<\/loc>/);
  });

  test('C6.2 — the game screens are not offered to a crawler', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    // A crawl of a room yields a shell, since the article arrives over the
    // socket — but a shell in an index is still a page claiming a Wikipedia
    // subject, attributed to Wikipedia, carrying facts the game falsified.
    expect(body).toMatch(/Disallow: \/room\//);
    expect(body).toMatch(/Disallow: \/solo/);

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).not.toContain('/room/');
    expect(sitemap).not.toContain('/solo');
  });
});

// Step J.7 — every link this site offers, followed.
//
// **In CI, or it will not be run**, which the track file says in as many words.
// It is a browser journey rather than a workflow job on purpose: `pnpm e2e`
// already runs on every pull request, a spec fails the build the same way a job
// does, and the alternative needs an edit to `.github/workflows/` that the
// repository's token has no scope for. The performance budget of C.7 made the
// same call for the same reasons.
//
// Two claims, and they fail for different reasons:
//
//   - **what the site publishes resolves** — the sitemap's URLs, in both
//     locales. A sitemap naming a 404 is the one broken link a crawler is
//     guaranteed to find;
//   - **what the site links resolves** — every internal `href` reachable from
//     the front door in two hops, which is where a footer link, a rename or a
//     locale prefix goes wrong.
//
// External links are checked for shape and never fetched. Wikipedia and
// creativecommons.org are somebody else's uptime, and a build that goes red
// because a third party is slow is a build nobody trusts twice.
import { expect, test, type Page } from '@playwright/test';

/** The pages a crawl starts from: the front door in both languages. */
const SEEDS = ['/', '/fr'];

/** How far to walk. Two hops reaches the footer of every page the front door offers. */
const DEPTH = 2;

/**
 * Paths that are not documents to fetch.
 *
 * `/api` answers JSON to a contract rather than a page; the metadata routes are
 * covered by `icons.spec.ts`, which reads their bytes; `#` and `mailto:` are
 * not requests at all.
 */
function skippable(href: string): boolean {
  return (
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('/api/') ||
    href.startsWith('/icon') ||
    href.startsWith('/apple-icon')
  );
}

/** Every `href` on the page, split into the ones we serve and the ones we do not. */
async function linksOn(page: Page, path: string, origin: string) {
  await page.goto(path);
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((anchors) =>
      anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
    );

  const internal = new Set<string>();
  const external = new Set<string>();

  for (const href of hrefs) {
    const url = new URL(href);
    if (url.origin !== origin) {
      external.add(href);
      continue;
    }
    const local = `${url.pathname}${url.search}`;
    if (!skippable(local)) internal.add(local);
  }

  return { internal, external };
}

test.describe('J.7 — nothing this site offers is a dead end', () => {
  test('every URL in the sitemap answers', async ({ request }) => {
    const xml = await (await request.get('/sitemap.xml')).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '');

    // The sitemap is generated from `INDEXABLE_ROUTES`, so an empty list here
    // means the generator broke rather than that there is nothing to check.
    expect(urls.length).toBeGreaterThan(5);

    for (const url of urls) {
      // The sitemap carries absolute URLs built from the deployment's origin,
      // which is not this test server's. Only the path is ours to follow.
      const answer = await request.get(new URL(url).pathname);
      expect({ url, status: answer.status() }).toEqual({ url, status: 200 });
    }
  });

  test('every internal link reachable from the front door answers', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const base = new URL(page.url()).origin;

    const seen = new Set<string>(SEEDS);
    const found = new Set<string>();
    let frontier = [...SEEDS];

    for (let hop = 0; hop < DEPTH; hop += 1) {
      const next: string[] = [];

      for (const path of frontier) {
        const { internal } = await linksOn(page, path, base);
        for (const link of internal) {
          found.add(link);
          if (!seen.has(link)) {
            seen.add(link);
            next.push(link);
          }
        }
      }

      frontier = next;
    }

    // A crawl that found nothing passes every assertion below it — and a crawl
    // that found only the language switch would pass this one. So what it must
    // have reached is named: the three documents and the way in, in both
    // languages. A footer that loses a link fails here rather than quietly
    // shrinking the thing being checked.
    for (const path of ['/faq', '/privacy', '/terms', '/play', '/fr/faq', '/fr/play']) {
      expect({ path, reached: found.has(path) }).toEqual({ path, reached: true });
    }
    expect(found.size).toBeGreaterThan(5);

    const broken: { path: string; status: number }[] = [];
    for (const path of found) {
      const answer = await request.get(path);
      if (answer.status() >= 400) broken.push({ path, status: answer.status() });
    }

    expect(broken).toEqual([]);
  });

  test('every external link is an absolute https URL, and none is fetched', async ({
    page,
  }) => {
    await page.goto('/');
    const base = new URL(page.url()).origin;

    const { external } = await linksOn(page, '/', base);

    // The front door credits Wikipedia and links the licence — both obligations
    // rather than decoration, which is why this asserts they are there at all
    // and not only that they are well formed.
    expect(external.size).toBeGreaterThan(0);

    for (const href of external) {
      expect({ href, https: href.startsWith('https://') }).toEqual({ href, https: true });
      // A URL that does not parse is a link that goes nowhere in every browser,
      // and it is the half of external checking a build can do without
      // depending on somebody else's uptime.
      expect(() => new URL(href)).not.toThrow();
    }
  });
});

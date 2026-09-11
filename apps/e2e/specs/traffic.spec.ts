// Step J.4 — the beacon, fired by a real browser.
//
// `record.test.ts` proves what the route accepts and `traffic.test.ts` that the
// counter survives two arrivals at once. Neither can say that anything is ever
// *sent*: the beacon runs in an effect, in a client component, on a page that is
// otherwise prerendered — and every way that goes wrong produces a page that
// renders perfectly and a counter that stays at zero.
//
// `sendBeacon` is also the one call here whose *body* a test cannot read:
// Chromium does not expose a blob payload to the debugging protocol, so
// `postDataJSON()` is null however correct the request is. What the page sends
// is asserted in `page-view.test.tsx`, against a stubbed `navigator`; what is
// asserted here is that a real browser fires it and the server counts it —
// `counted: true` is only ever the answer to a body the route could parse.
import { expect, test, type Page } from '@playwright/test';

/** The beacon this page fires, waited for rather than polled. */
async function beaconFrom(path: string, page: Page) {
  const sent = page.waitForRequest(
    (request) => request.url().endsWith('/api/view') && request.method() === 'POST',
  );
  await page.goto(path);
  return sent;
}

test.describe('J.4 — an arrival is counted', () => {
  test('the landing sends one, and the server counts it', async ({ page }) => {
    const request = await beaconFrom('/', page);
    const answer = await request.response();

    expect(answer?.status()).toBe(200);
    // The whole journey in one field: the browser's own origin passed the
    // check, the blob arrived as JSON the route could parse, and a row moved.
    // A body it could not read answers `counted: false` with the same 200.
    expect(await answer?.json()).toEqual({ counted: true });
  });

  test('the entry screen sends the other half of the funnel', async ({ page }) => {
    const request = await beaconFrom('/play', page);

    expect(await (await request.response())?.json()).toEqual({ counted: true });
  });

  test('the French landing counts too', async ({ page }) => {
    // No locale in the counter, deliberately — `10-seo-analytics.md` says why.
    // What matters here is that the French route is not a page that silently
    // stopped counting.
    const request = await beaconFrom('/fr', page);

    expect(await (await request.response())?.json()).toEqual({ counted: true });
  });

  test('and nothing comes back that could follow the reader', async ({ page }) => {
    const request = await beaconFrom('/', page);
    const answer = await request.response();
    expect(answer).not.toBeNull();

    // The route reads no cookie and writes none. A `set-cookie` here would turn
    // a counter into the tracking the privacy policy says this site does not do.
    const headers = await (answer as NonNullable<typeof answer>).allHeaders();
    expect(headers['set-cookie']).toBeUndefined();
  });
});

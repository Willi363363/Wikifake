// Step J.2 — the icons and the manifest, fetched rather than described.
//
// `mark.palette.test.ts` holds the colours and `manifest.test.ts` the words.
// Neither can say whether any of it is *served*, and this step has three ways
// to be green and broken, all of them found by C.8 on the card before it:
//
// - a metadata route reads two font files off disk. Every way that goes wrong
//   produces a build that succeeds and a route that 500s;
// - `/icon/192` has no file extension, so the locale proxy would rewrite it to
//   `/en/icon/192` — a 404 where a home screen expected a picture;
// - `manifest.ts` exports an async function. If the generated handler did not
//   await it, the document served would be `{}` and every unit assertion about
//   it would still pass.
//
// So: fetch each one, read its bytes, and refuse a redirect on the way.
import { expect, test } from '@playwright/test';

/**
 * A PNG's own header, read from the bytes.
 *
 * The signature and the `IHDR` dimensions: eight bytes of magic, then a chunk
 * whose width and height are big-endian at offsets 16 and 20. `Content-Type` is
 * what a server says it sent; this is what it sent.
 */
function pngSize(bytes: Buffer): { png: boolean; width: number; height: number } {
  return {
    png: bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test.describe('J.2 — the icons', () => {
  for (const size of [32, 192, 512]) {
    test(`/icon/${String(size)} is a square PNG of that size`, async ({ request }) => {
      // `maxRedirects: 0` is the assertion, not a setting: the locale proxy
      // answered 307 here before `METADATA_ROUTES` named these routes, and a
      // home screen fetching an icon does not argue with a redirect.
      const answer = await request.get(`/icon/${String(size)}`, { maxRedirects: 0 });

      expect({ size, status: answer.status() }).toEqual({ size, status: 200 });
      expect(answer.headers()['content-type']).toBe('image/png');
      expect({ size, ...pngSize(await answer.body()) }).toEqual({
        size,
        png: true,
        width: size,
        height: size,
      });
    });
  }

  test('/apple-icon is the 180 square iOS asks for', async ({ request }) => {
    const answer = await request.get('/apple-icon', { maxRedirects: 0 });

    expect(answer.status()).toBe(200);
    expect(answer.headers()['content-type']).toBe('image/png');
    expect(pngSize(await answer.body())).toEqual({ png: true, width: 180, height: 180 });
  });

  test('/favicon.ico answers, for the clients that ask by name', async ({ request }) => {
    // Next stops serving that path the moment `app/icon.tsx` exists, and the
    // clients that request it are the ones that never read the document to find
    // out otherwise. `next.config.ts` rewrites it onto the 32px icon; this is
    // what says the rewrite survived a build.
    const answer = await request.get('/favicon.ico', { maxRedirects: 0 });

    expect(answer.status()).toBe(200);
    expect(pngSize(await answer.body())).toEqual({ png: true, width: 32, height: 32 });
  });

  test('the front door declares them, in both locales', async ({ page }) => {
    for (const path of ['/', '/fr']) {
      await page.goto(path);

      // Next writes these from `app/icon.tsx` and `app/apple-icon.tsx`, with a
      // cache-busting query appended. The icon is the same drawing in every
      // language, so the same tags are expected under `/fr`.
      const icons = page.locator('link[rel="icon"]');
      await expect(icons).not.toHaveCount(0);

      const hrefs = await icons.evaluateAll((links) =>
        links.map((link) => (link as HTMLLinkElement).getAttribute('href') ?? ''),
      );
      expect({ path, declared: hrefs.some((href) => href.includes('/icon/')) }).toEqual({
        path,
        declared: true,
      });

      await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
    }
  });
});

test.describe('J.2 — the manifest', () => {
  test('is linked, served, and is a document rather than an empty object', async ({
    page,
    request,
  }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).not.toBeNull();

    const answer = await request.get(href as string, { maxRedirects: 0 });
    expect(answer.status()).toBe(200);

    const document = (await answer.json()) as {
      name?: string;
      short_name?: string;
      icons?: { src: string }[];
    };

    // The async export, proved. An unawaited handler serves `{}` here.
    expect(document.short_name).toBe('WikiFake');
    expect(document.name ?? '').toContain('WikiFake');
    expect(document.icons ?? []).toHaveLength(2);
  });

  test('names icons that answer, without a detour', async ({ request }) => {
    const document = (await (await request.get('/manifest.webmanifest')).json()) as {
      icons: { src: string; sizes: string }[];
    };

    for (const icon of document.icons) {
      const answer = await request.get(icon.src, { maxRedirects: 0 });
      expect({ src: icon.src, status: answer.status() }).toEqual({
        src: icon.src,
        status: 200,
      });

      const [width] = icon.sizes.split('x').map(Number);
      expect({ src: icon.src, ...pngSize(await answer.body()) }).toEqual({
        src: icon.src,
        png: true,
        width,
        height: width,
      });
    }
  });
});

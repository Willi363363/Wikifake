// Step C.2 — the stage, in a browser.
//
// `stage-progress.test.ts` proves the arithmetic and `stage.test.tsx` proves the
// markup. Neither can prove the two claims that actually matter about a scroll
// scene, because jsdom has no layout and no scrolling:
//
// - **the scroll is the browser's**, not something the page animates for it;
// - **the reduced-motion path is a document**, not a frozen first frame.
//
// Both are non-negotiables of `plans/product/03-landing.md`, and both are the
// kind of thing that passes a unit suite and fails a visitor.
import { expect, test, type Page } from '@playwright/test';

/** What the driver publishes, read off the track element. */
async function progress(page: Page): Promise<number> {
  return page.evaluate(() => {
    const track = document.querySelector<HTMLElement>('.landing-stage__track');
    return Number(track?.style.getPropertyValue('--stage-progress') ?? '0');
  });
}

test.describe('C.2 — the stage moves with the scroll, and never takes it', () => {
  test('scrolls exactly as far as it was asked to', async ({ page }) => {
    await page.goto('/');

    // The single most common failure in this register: a page that intercepts
    // the wheel and animates its own scroll. The scrollbar then lies, the
    // keyboard lands somewhere else, and a screen reader loses its place. Here
    // the browser is asked for 900 pixels and the page is at 900 pixels.
    await page.evaluate(() => {
      window.scrollTo(0, 900);
    });
    expect(await page.evaluate(() => window.scrollY)).toBe(900);

    // And the keyboard's own scrolling still works, which is the same claim
    // from the side a mouse never tests.
    await page.keyboard.press('End');
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(900);
  });

  test('advances from 0 to 1 across the track', async ({ page }) => {
    await page.goto('/');
    await expect.poll(async () => progress(page)).toBe(0);

    const half = await page.evaluate(() => {
      const track = document.querySelector<HTMLElement>('.landing-stage__track');
      return (track?.offsetHeight ?? 0) / 2;
    });
    expect(half).toBeGreaterThan(0);

    await page.evaluate((to: number) => {
      window.scrollTo(0, to);
    }, half);
    await expect.poll(async () => progress(page)).toBeGreaterThan(0.3);

    await page.keyboard.press('End');
    await expect.poll(async () => progress(page)).toBe(1);
  });

  test('keeps the keyboard out of the beats nobody can see', async ({ page }) => {
    await page.goto('/');

    // A transparent link is still a link. Without `inert`, tabbing from the top
    // of this page walks through three invisible calls to action before it
    // reaches the one on screen.
    await expect
      .poll(() =>
        page.evaluate(() => document.querySelectorAll('[data-stage-beat][inert]').length),
      )
      .toBeGreaterThan(0);

    const first = await page.evaluate(() =>
      document.querySelector('[data-stage-beat]')?.hasAttribute('inert'),
    );
    expect(first).toBe(false);
  });
});

test.describe('C.2 — with the preference for less motion', () => {
  // `contextOptions`, not a bare `reducedMotion` — `accessibility.spec.ts`
  // carries the reason: the short form is accepted and silently ignored, and
  // this test passed against a sticky camera until it was written this way.
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('is a document, not a frozen scene', async ({ page }) => {
    await page.goto('/');

    // The switch is the media query, so the camera is simply never sticky —
    // there is no second copy of the decision in JavaScript to disagree.
    const position = await page.evaluate(() => {
      const camera = document.querySelector('.landing-stage__camera');
      return camera === null ? null : getComputedStyle(camera).position;
    });
    expect(position).toBe('static');

    // Every beat in the document, in order, and nothing removed from the
    // keyboard's reach.
    for (const name of [
      'Who is lying?',
      'It starts with a real article',
      'Then a model rewrites a few facts',
      'You mark what is wrong, and the clock is watching',
    ]) {
      await expect(page.getByRole('heading', { name })).toBeVisible();
    }

    expect(
      await page.evaluate(
        () => document.querySelectorAll('[data-stage-beat][inert]').length,
      ),
    ).toBe(0);
  });
});

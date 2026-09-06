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

test.describe('C.3 — beats 1 and 2 arrive in layers', () => {
  /**
   * Scrolls to a point in the scene, named as the scene names it.
   *
   * Computed from the track's own box rather than from the page height: the
   * document has padding above the stage, so "a third of the way down the page"
   * and "beat 2's turn" are two different places, and the first is the one that
   * makes an assertion about the second fail by 10 pixels.
   */
  async function scrollTo(page: Page, progress: number): Promise<void> {
    await page.evaluate((to: number) => {
      const track = document.querySelector<HTMLElement>('.landing-stage__track');
      if (track === null) return;
      const top = track.getBoundingClientRect().top + window.scrollY;
      const travel = track.offsetHeight - window.innerHeight;
      window.scrollTo(0, Math.round(top + travel * to));
    }, progress);
    await page.waitForTimeout(120);
  }

  /** What a transform is actually applying, in pixels. */
  async function moved(page: Page, selector: string): Promise<{ x: number; y: number }> {
    return page.evaluate((css: string) => {
      const node = document.querySelector(css);
      if (node === null) return { x: Number.NaN, y: Number.NaN };
      const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      return { x: matrix.m41, y: matrix.m42 };
    }, selector);
  }

  test('moves the question further than the brand line above it', async ({ page }) => {
    await page.goto('/');

    // The handover, halfway between beat 1's turn and beat 2's. At rest every
    // layer is at zero, which would make this pass on a page with no depth in
    // it at all.
    await scrollTo(page, 1 / 6);

    const question = await moved(page, '#landing-question');
    const brand = await moved(page, '.landing-move--back');

    // Nearer the camera travels further, and against the scroll. The brand line
    // is behind it, so it lags — the two move in opposite directions and the
    // gap between them is the depth.
    expect(question.y).toBeLessThan(0);
    expect(brand.y).toBeGreaterThan(0);
    expect(brand.y - question.y).toBeGreaterThan(24);
  });

  test('drifts the paragraph in from the right and settles it', async ({ page }) => {
    await page.goto('/');

    // Before its turn it waits to one side.
    expect((await moved(page, '.landing-move--from-right')).x).toBeGreaterThan(100);

    // On its turn it is where the document would have put it.
    await scrollTo(page, 1 / 3);
    expect((await moved(page, '.landing-move--from-right')).x).toBeLessThan(1);

    // And it leaves straight up: something that arrived from the right and left
    // to the right would read as a carousel.
    await scrollTo(page, 1);
    expect((await moved(page, '.landing-move--from-right')).x).toBe(0);
  });
});

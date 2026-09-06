// The scene of track C, as a browser can measure it.
//
// Shared by `landing.spec.ts` and `landing-scene.spec.ts`: the first asks
// whether the stage engages at all, the second what it does once it has. Both
// need to stand at a named point in the scene, and "a third of the way down the
// page" is not one — the document has padding above the stage, so the page's
// thirds and the scene's beats are ten pixels apart.
import type { Page } from '@playwright/test';

/** Scrolls to a point in the scene, in the scene's own units. */
export async function scrollTo(page: Page, progress: number): Promise<void> {
  await page.evaluate((to: number) => {
    const track = document.querySelector<HTMLElement>('.landing-stage__track');
    if (track === null) return;
    const top = track.getBoundingClientRect().top + window.scrollY;
    const travel = track.offsetHeight - window.innerHeight;
    window.scrollTo(0, Math.round(top + travel * to));
  }, progress);
  // One frame plus the driver's own, and then some: the paint is rAF-batched.
  await page.waitForTimeout(140);
}

/** What the driver has published on the track. */
export async function stageProgress(page: Page): Promise<number> {
  return page.evaluate(() => {
    const track = document.querySelector<HTMLElement>('.landing-stage__track');
    return Number(track?.style.getPropertyValue('--stage-progress') ?? '0');
  });
}

/** What a transform is actually applying to one element, in pixels. */
export async function moved(
  page: Page,
  selector: string,
): Promise<{ x: number; y: number }> {
  return page.evaluate((css: string) => {
    const node = document.querySelector(css);
    if (node === null) return { x: Number.NaN, y: Number.NaN };
    const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
    return { x: matrix.m41, y: matrix.m42 };
  }, selector);
}

/** Where the two article sheets are, and how solid their beats and heads are. */
export async function sheets(page: Page) {
  return page.evaluate(() =>
    // `Array.from` rather than a spread: this package's `lib` has `dom` without
    // `dom.iterable`, so a `NodeList` is not iterable at the type level here.
    Array.from(document.querySelectorAll('.landing-article')).map((article) => {
      const box = article.querySelector('figure')?.getBoundingClientRect();
      const beat = article.closest('[data-stage-beat]');
      return {
        top: Math.round(box?.top ?? Number.NaN),
        left: Math.round(box?.left ?? Number.NaN),
        width: Math.round(box?.width ?? Number.NaN),
        beat: Number(beat === null ? 0 : getComputedStyle(beat).opacity),
        head: Number(
          getComputedStyle(article.querySelector('.landing-article__head') as Element)
            .opacity,
        ),
      };
    }),
  );
}

/**
 * Which of the matching elements have finished arriving.
 *
 * Half opacity is the threshold rather than 1, and the ramps are 0.03 of a beat
 * wide — about two frames — so an element is either on or off and nothing sits
 * near the line. What this asks is "has it appeared", which is the claim a
 * staggered assembly actually makes.
 */
export async function revealed(page: Page, selector: string): Promise<boolean[]> {
  return page.evaluate(
    (css: string) =>
      Array.from(document.querySelectorAll(css)).map(
        (node) => Number(getComputedStyle(node).opacity) > 0.5,
      ),
    selector,
  );
}

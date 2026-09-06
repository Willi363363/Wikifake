// Steps C.3 and C.4 — what the stage does once it has engaged.
//
// `landing.spec.ts` asks whether the camera holds still and whether the
// reduced-motion path is a document. This asks what travels across it: the
// layers of a beat, and the collision that is the whole product demonstration.
//
// Every assertion here is a measurement rather than a screenshot. A scene is a
// thing a person judges by looking; what a test can hold is that the false
// paragraph lands on the rectangle the true one held, to the pixel, and that
// nothing but the article survives the cut between them.
import { expect, test } from '@playwright/test';

import { moved, scrollTo, sheets } from './landing-stage.js';

test.describe('C.3 — beats 1 and 2 arrive in layers', () => {
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

test.describe('C.4 — the collision', () => {
  test('lands the false paragraph on the rectangle the true one held', async ({
    page,
  }) => {
    await page.goto('/');

    await scrollTo(page, 1 / 3);
    const [trueSheet] = await sheets(page);

    await scrollTo(page, 2 / 3);
    const [, falseSheet] = await sheets(page);

    // The same rectangle, to the pixel. That alignment is the demonstration:
    // the reader watches one number change under them rather than watching two
    // cards cross-fade.
    expect(falseSheet?.top).toBe(trueSheet?.top);
    expect(falseSheet?.left).toBe(trueSheet?.left);
    expect(falseSheet?.width).toBe(trueSheet?.width);
  });

  test('cuts the words and keeps the article through the handover', async ({ page }) => {
    await page.goto('/');
    await scrollTo(page, 0.5);

    const [under, over] = await sheets(page);

    // Both beats solid, both headings gone: at the moment two beats change
    // places the only thing on the stage is the article. That is what makes
    // this a collision rather than a dissolve.
    expect(under?.beat).toBe(1);
    expect(over?.beat).toBe(1);
    expect(under?.head).toBe(0);
    expect(over?.head).toBe(0);

    // Level with each other, and closing. The beats drift three rems against
    // the scroll and the sheets cancel exactly that, or the two would pass at
    // six rems apart instead of one landing on the other.
    expect(over?.top).toBe(under?.top);
    expect(over?.left).toBeLessThan(under?.left ?? 0);
  });

  test('wipes the mark in rather than fading it', async ({ page }) => {
    await page.goto('/');

    const wipe = async (): Promise<number> =>
      page.evaluate(() => {
        const mark = document.querySelector('.landing-mark');
        if (mark === null) return Number.NaN;
        return new DOMMatrixReadOnly(getComputedStyle(mark, '::before').transform).a;
      });

    // Nothing marked before the beat that marks it.
    await scrollTo(page, 1 / 3);
    expect(await wipe()).toBe(0);

    // A hard edge travelling left to right, finished on the beat's turn.
    await scrollTo(page, 2 / 3);
    expect(await wipe()).toBe(1);
  });
});

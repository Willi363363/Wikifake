// What "does not scroll sideways" means, in one place — step J.10.
//
// Phase 6 wrote this measurement against four routes. J.1 found that tracks E
// to I had added eight more and that none of them was measured, so J.10 sweeps
// the rest — and a second copy of the measurement is how two sweeps end up
// disagreeing about what overflow is rather than about the pages.
import type { Page } from '@playwright/test';

/**
 * 360 CSS pixels: a phone held upright, and `--width-floor` in the theme.
 *
 * The page itself must never scroll sideways. A wide table or a code block
 * inside its own `overflow-x` container is fine and is not what this looks at.
 */
export const PHONE_WIDTH = { viewport: { width: 360, height: 800 } } as const;

/** What overflowed, or null when nothing did. */
export interface Overflow {
  readonly scrollWidth: number;
  readonly clientWidth: number;
  readonly culprits: { tag: string; class: string; right: number }[];
}

/**
 * The page measured after it has settled, with the widest elements attached.
 *
 * A bare "it overflowed" costs whoever reads the failure an evening, so the
 * assertion carries the elements that stick out past the viewport.
 */
export async function overflowOn(page: Page): Promise<Overflow | null> {
  // Fonts and images change layout after first paint, and a page measured too
  // early is a page measured before the thing that overflows arrived.
  await page.waitForLoadState('networkidle');

  return page.evaluate(() => {
    const root = document.documentElement;
    // One pixel of slack: sub-pixel layout rounds, and a 0.5 px difference is
    // not a page a thumb can push off-screen.
    const slack = 1;
    if (root.scrollWidth <= root.clientWidth + slack) return null;

    const culprits = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter(
        (element) => element.getBoundingClientRect().right > root.clientWidth + slack,
      )
      .slice(0, 5)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        class: element.className.toString().slice(0, 80),
        right: Math.round(element.getBoundingClientRect().right),
      }));

    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, culprits };
  });
}

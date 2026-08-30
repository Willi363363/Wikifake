// The two criteria phase 6 could only infer.
//
// Its exit gate asks that `prefers-reduced-motion` neutralise the shakes and the
// flashes, and that the interface hold at 360 px. Both were checked by reading a
// stylesheet — `motion.test.ts` over `motion.css`, `responsive.test.ts` over the
// declared lengths — because the phase ran before there was a browser in CI, and
// its own sheet said so twice.
//
// That evidence is real and it is not the criterion. A media block can be
// written correctly and still not apply: it can land in a layer the build drops,
// behind a selector the page never matches, in a file no route imports. And a
// page can declare no oversized length and still scroll sideways, because
// overflow comes from content — a long word, a wide table, a flex row that
// refuses to wrap — as often as from a declaration.
//
// Step 9.5 brought Playwright. These are the same two questions, asked of a
// browser that actually painted the page.
import { expect, test, type Page } from '@playwright/test';
import { REDUCIBLE } from '@wikifake/ui/motion';

/** What `motion.css` names an animation: `shake` is `--animate-shake`. */
const custom = (name: string): string => `--animate-${name}`;

/** Every reducible animation, as the browser resolves it on `:root`. */
async function animationsOn(page: Page) {
  return page.evaluate((names: readonly string[]) => {
    const root = getComputedStyle(document.documentElement);
    return Object.fromEntries(
      names.map((name) => [name, root.getPropertyValue(`--animate-${name}`).trim()]),
    );
  }, REDUCIBLE);
}

test.describe('6.3 — prefers-reduced-motion, in a browser that has the preference', () => {
  // The list comes from `@wikifake/ui`, not from a copy: `REDUCIBLE` is derived
  // from `MOTIONS`, so an animation marked reducible tomorrow is asserted here
  // tomorrow. A hand-written list in this file is the drift the unit suite
  // already refuses at the stylesheet's level.
  // `contextOptions`, not a top-level `reducedMotion`. Playwright's own
  // documentation shows the short form and this version's types do not declare
  // it: it is a `BrowserContextOptions` field, so it reaches the fixture through
  // `contextOptions` or not at all. Written down because the short form
  // typechecks nowhere and fails with a message about `Fixtures`.
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('switches off every flash and every displacement', async ({ page }) => {
    await page.goto('/play');
    await expect(page.getByLabel('Wikipedia topic')).toBeVisible();

    const resolved = await animationsOn(page);

    // Named one by one rather than asserted in bulk: a failure has to say which
    // animation still runs, because three of these are a photosensitivity
    // hazard and not a comfort setting — `screen-flash` and `lightning-zap` at
    // about 4.4 flashes a second, against a threshold of three.
    for (const name of REDUCIBLE) {
      expect({ animation: custom(name), value: resolved[name] }).toEqual({
        animation: custom(name),
        value: 'none',
      });
    }
  });
});

test.describe('6.3 — and the preference is what does it', () => {
  // The control, and the reason this file is worth more than the unit suite it
  // duplicates. Without it, a theme that shipped `none` unconditionally — an
  // animation deleted, a variable renamed, a build that dropped the whole
  // block — would pass the test above while neutralising nothing, because
  // "no animation at all" and "the preference was honoured" look identical from
  // inside a reduced-motion context.
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('leaves them running when nobody asked for less', async ({ page }) => {
    await page.goto('/play');
    await expect(page.getByLabel('Wikipedia topic')).toBeVisible();

    const resolved = await animationsOn(page);
    const running = REDUCIBLE.filter((name) => resolved[name] !== 'none');

    expect(running).toEqual([...REDUCIBLE]);
  });
});

test.describe('6.5 — the interface at 360 px', () => {
  // 360 CSS pixels: a phone held upright, and `--width-floor` in the theme. The
  // page itself must never scroll sideways; a wide table or a code block inside
  // its own `overflow-x` container is fine and is not what this looks at.
  test.use({ viewport: { width: 360, height: 800 } });

  // `/gallery` is the one the phase's own criterion names — it renders every
  // component the design system exports, so it is the widest page there is.
  for (const route of ['/', '/play', '/gallery']) {
    test(`${route} does not scroll sideways`, async ({ page }) => {
      await page.goto(route);
      // Fonts and images change layout after first paint, and a page measured
      // too early is a page measured before the thing that overflows arrived.
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        // One pixel of slack: sub-pixel layout rounds, and a 0.5 px difference
        // is not a page a thumb can push off-screen.
        const slack = 1;
        if (root.scrollWidth <= root.clientWidth + slack) return null;

        // A bare "it overflowed" costs whoever reads this failure an evening,
        // so the assertion carries the widest elements with it.
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

      expect(overflow).toBeNull();
    });
  }
});

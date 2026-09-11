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

import { someone, signUp } from './accounts.js';
import { PHONE_WIDTH, overflowOn } from './phone.js';

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

/*
 * The round, at 360, with an article actually on screen.
 *
 * The static routes below are entry screens: a form, a heading, a button. The
 * screen this game is played on is none of those — it is a Wikipedia article
 * of several hundred words, with a clock, a score, an item bar and other
 * players' cursors over it, and it is the only screen where a single unbroken
 * German compound decides the width of the page.
 *
 * Step D.8 asked for every screen at phone width. This is the one that could
 * not be reached by navigating to a URL, so it is reached by playing.
 */
test.describe('D.8 — the round at 360 px', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test('the article screen does not scroll sideways', async ({ page }) => {
    await page.goto('/play');
    await page.getByLabel('Wikipedia topic').fill('Chat');
    await page.getByRole('button', { name: 'Play solo' }).click();

    const article = page.getByRole('article');
    await expect(article).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      if (root.scrollWidth <= root.clientWidth + 1) return null;
      return { scroll: root.scrollWidth, client: root.clientWidth };
    });

    expect(overflow).toBeNull();
  });

  // The paragraph is the reading surface, and a measure that has collapsed to
  // one word per line is a paragraph nobody can judge. Two words is a floor,
  // not a target: it says the prose still wraps like prose.
  test('the prose still reads as prose', async ({ page }) => {
    await page.goto('/play');
    await page.getByLabel('Wikipedia topic').fill('Chat');
    await page.getByRole('button', { name: 'Play solo' }).click();

    const article = page.getByRole('article');
    await expect(article).toBeVisible({ timeout: 30_000 });

    const box = await article.getByRole('button').first().boundingBox();
    expect(box).not.toBeNull();
    expect(box?.width).toBeGreaterThan(200);
  });
});

test.describe('6.5 — the interface at 360 px', () => {
  test.use(PHONE_WIDTH);

  /*
   * The four phase 6 named, and the six J.10 added.
   *
   * `/gallery` is the one the phase's own criterion names — it renders every
   * component the design system exports, so it is the widest page there is.
   * The rest are every screen an arrival can render without an account, which
   * is what J.1 found this list had stopped being: it named four routes while
   * ten existed, and it had not weakened — the application had grown out of it.
   */
  const ANONYMOUS = [
    '/',
    '/play',
    '/solo',
    '/gallery',
    '/leaderboard',
    '/sign-in',
    '/sign-up',
    '/faq',
    '/privacy',
    '/terms',
  ];

  for (const route of ANONYMOUS) {
    test(`${route} does not scroll sideways`, async ({ page }) => {
      await page.goto(route);

      // Reached, and not merely answered. A route that redirected to the sign-in
      // form would measure the sign-in form and pass — which is the failure this
      // sweep is most likely to have, since half these screens are one
      // redirect away from being somebody else's.
      expect(new URL(page.url()).pathname).toBe(route);

      expect(await overflowOn(page)).toBeNull();
    });
  }
});

test.describe('J.10 — and the screens behind an account', () => {
  test.use(PHONE_WIDTH);

  /*
   * One test for three screens, because the account is the expensive part.
   *
   * `/profile`, `/quests` and `/shop` send an anonymous visitor to `/sign-in`
   * or `/sign-up`, so sweeping them as a stranger measures the form instead —
   * which is exactly how a screen can be unmeasured while appearing in a list
   * of measured screens. The assertion is therefore two things at once:
   * **the screen is reachable** by somebody entitled to it, and it fits.
   */
  test('a signed-in player can read their own screens at 360 px', async ({ page }) => {
    const who = someone('phone');
    await signUp(page, who);
    // The helper's own comment says it waits and it does not —
    // `06-structural-debt.md` records that, and every caller pays for it here.
    // Without this the first `goto` races the session cookie and lands on
    // `/sign-in`, which is exactly what the assertion below is for.
    await expect(page).toHaveURL(/\/play$/);

    for (const [route, heading] of [
      ['/profile', who.pseudonym],
      ['/quests', 'Quests'],
      ['/shop', 'Shop'],
    ] as const) {
      await page.goto(route);

      // The screen itself rather than a redirect to one of the forms.
      expect(new URL(page.url()).pathname).toBe(route);
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();

      expect({ route, overflow: await overflowOn(page) }).toEqual({
        route,
        overflow: null,
      });
    }
  });

  /*
   * `/admin` is not swept, and that is a decision rather than an omission.
   *
   * It answers 404 to everybody who is not an administrator, and nothing in
   * this suite can make one: the role is a row in `admin`, written by hand.
   * What would be needed is a database fixture for a screen whose only reader
   * is the owner of the deployment — `10-seo-sweep.md` records the trade.
   */
});

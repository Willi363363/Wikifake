// Step C.6 — the three ways the scene does not engage, each read as a document.
//
// Non-negotiable 2 of `plans/product/03-landing.md`: "with
// `prefers-reduced-motion`, the scene resolves to a static, correctly ordered
// document — headings, text, a call to action. Not a frozen animation. Not a
// blank stage." Step C.2 built three switches for that, and only one of them had
// ever been looked at:
//
// - **the preference**, which `landing.spec.ts` checks the camera against;
// - **the width**, which nothing checked at all;
// - **JavaScript**, whose `<noscript>` revert `stage.test.tsx` checks the *text*
//   of — that the block contains three declarations — and never the effect.
//
// The difference between those two matters, and this file is what it cost to
// find out: the revert reverted the stage and left every ramp inside it running,
// so a browser with scripting off received beat 1 and three empty screens. The
// declarations were all present. The page was blank.
//
// So the assertion here is one function asked of all three paths, and it is
// deliberately about the *document* rather than about the switch: every heading
// in order, both ways in, nothing transparent, nothing displaced, no sideways
// scroll. A page that passes it is a page somebody can read and play from,
// whichever of the three reasons brought them to it.
import { expect, test, type Page } from '@playwright/test';

/** The four beats, by their headings, in the order the document tells them. */
const HEADINGS = [
  'Who is lying?',
  'It starts with a real article',
  'Then a model rewrites a few facts',
  'You mark what is wrong, and the clock is watching',
];

/** What the scoreboard of beat 4 says, and what a blank last screen loses. */
const OUTCOMES = [
  'A falsified paragraph you marked',
  'One you read straight past',
  'A true paragraph you marked',
  'Each second still on the clock',
];

/** Every element of the scene that a beat's own ramps make transparent. */
const RAMPED =
  '.landing-stage__beat, .landing-stage__beat > *, .landing-article__head, .landing-article__credit, .landing-article__tail, .landing-scoreboard__row, .landing-way-in';

/** Anything the scene moves, plus the wipe that reveals the mark. */
const MOVED = '.landing-move, .landing-stage__beat';

/**
 * The parts of the page that only a driven stage would hide.
 *
 * Read in one evaluate rather than as six `toBeVisible` calls: what is being
 * asked is whether the page is a document, and a failure should say which of the
 * six ways it is not rather than stopping at the first.
 */
async function documentState(page: Page) {
  return page.evaluate(
    ({ ramped, moved }: { ramped: string; moved: string }) => {
      const all = (css: string): Element[] => Array.from(document.querySelectorAll(css));

      const camera = document.querySelector('.landing-stage__camera');

      return {
        // The stage's own facts. A camera that is still sticky with no driver
        // behind it is the failure this whole file exists for, and one that
        // still clips is a camera three beats are hidden inside.
        camera: camera === null ? null : getComputedStyle(camera).position,
        clips: camera === null ? null : getComputedStyle(camera).overflow,
        // A beat out of the flow is a beat stacked on the one before it. In a
        // document they are simply sections, one after another.
        stacked: all('[data-stage-beat]')
          .map((beat) => getComputedStyle(beat).position)
          .filter((position) => position !== 'static'),
        inert: all('[data-stage-beat][inert]').length,

        // Nothing is faded out, and nothing has been pushed off its place.
        faded: all(ramped)
          .filter((node) => Number(getComputedStyle(node).opacity) < 1)
          .map((node) => node.className),
        displaced: all(moved)
          .filter((node) => {
            const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
            return matrix.m41 !== 0 || matrix.m42 !== 0;
          })
          .map((node) => node.className),

        // The headings in the order the markup has them, which is the order a
        // browser with no stylesheet at all would read them in.
        headings: all('h1, h2').map((node) => node.textContent?.trim() ?? ''),

        // A phone is one of the three paths, and a page that scrolls sideways
        // on one is a page nobody reads to the end.
        sideways: document.documentElement.scrollWidth > window.innerWidth + 1,
      };
    },
    { ramped: RAMPED, moved: MOVED },
  );
}

/**
 * The whole claim of non-negotiable 2, asked of one page.
 *
 * Every path below gets exactly this, because "resolves to a document" is one
 * property and three ways of arriving at it. A path with its own weaker version
 * of this function would be a path nobody notices going quiet.
 */
async function readsAsADocument(page: Page): Promise<void> {
  await page.goto('/');

  const state = await documentState(page);

  expect(state.camera).toBe('static');
  expect(state.clips).toBe('visible');
  expect(state.stacked).toEqual([]);
  expect(state.inert).toBe(0);
  expect(state.faded).toEqual([]);
  expect(state.displaced).toEqual([]);
  expect(state.headings).toEqual(HEADINGS);
  expect(state.sideways).toBe(false);

  // The demonstration itself, in words: the extract, the number that moved, and
  // the sentence that names both. A visitor who never sees the collision has to
  // be able to read what it was.
  await expect(page.getByText('La tour Eiffel', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('330 m became 290 m', { exact: false })).toBeVisible();

  for (const outcome of OUTCOMES) {
    await expect(page.getByText(outcome, { exact: true })).toBeVisible();
  }

  // Both ways in, and the licence notice that quoting Wikipedia obliges — it
  // sits outside the stage precisely so that it survives every path here.
  const ways = page.getByRole('link', { name: 'Play' });
  await expect(ways).toHaveCount(2);
  await expect(ways.first()).toBeVisible();
  await expect(ways.last()).toBeVisible();
  await expect(page.getByText('Text deliberately modified.')).toBeVisible();
}

test.describe('C.6 — a viewer who asked for less motion', () => {
  // `contextOptions`, not a bare `reducedMotion`: the short form typechecks
  // nowhere in this version and is silently ignored. `accessibility.spec.ts`
  // carries the full reason.
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('receives the document, whole', async ({ page }) => {
    await readsAsADocument(page);
  });

  test('can reach both ways in with the keyboard alone', async ({ page }) => {
    await page.goto('/');

    // The exit gate's first line: "keyboard alone, reach the call to action and
    // start a game, top to bottom". Tabbing from the top of the document, both
    // calls to action come round in order — and neither is behind an `inert`
    // beat, because there are no beats here, only sections.
    const seen: string[] = [];
    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => {
        const node = document.activeElement;
        return node === null ? '' : `${node.tagName}:${node.textContent?.trim() ?? ''}`;
      });
      if (focused.startsWith('A:Play')) seen.push(focused);
      if (seen.length === 2) break;
    }
    expect(seen).toHaveLength(2);

    // And the last one focused actually starts a game.
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/play$/);
  });
});

test.describe('C.6 — a phone, which the scene never engages on', () => {
  // Below `md` the camera is never sticky: a fixed viewport 640 pixels tall is a
  // viewport that clips the article it is trying to show. 360 is the floor
  // `--width-floor` names and the width every other screen is held to.
  test.use({ viewport: { width: 360, height: 640 } });

  test('receives the document, whole', async ({ page }) => {
    await readsAsADocument(page);
  });
});

test.describe('C.6 — a browser running no script', () => {
  // The switch a stylesheet cannot ask about. Here the media query *is* on —
  // wide viewport, no stated preference — so every rule of the scene applies and
  // the `<noscript>` block is the only thing standing between a visitor and four
  // stacked screens that never advance.
  test.use({ javaScriptEnabled: false });

  test('receives the document, whole', async ({ page }) => {
    await readsAsADocument(page);
  });
});

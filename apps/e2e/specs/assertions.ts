// The assertions that are the point of running a browser at all.
//
// Everything else in this repository is tested without one, and better: a unit
// suite says what a component does, and says it in a second. What a browser adds
// is the **whole page** — every attribute, every serialised payload the framework
// inlined, every script tag — and that is exactly the surface C1.1 is about.
//
// With Server Components an object passed from server to client is serialised
// into the document. A leak therefore does not appear as a field called
// `explanation`; it appears as the sentence, somewhere in the markup, in a place
// no component names. So the assertion is **by value**, and the values are the
// markers `@wikifake/article/testing` stamps into the fixture for exactly this.
import { expect, type Page } from '@playwright/test';

/**
 * Strings that must not be in the page while a round is running.
 *
 * `ORIGINALMARKER` is the untouched text of a falsified paragraph — C1.1's "no
 * original text". `TRUTHMARKER` is the explanation. `HINTMARKER` is a hint
 * nobody has paid for. Each is unique and unpronounceable, which is what stops
 * a substring check passing by accident against French prose.
 */
export const KEPT_BACK = ['ORIGINALMARKER', 'TRUTHMARKER', 'HINTMARKER'] as const;

/** Everything the browser holds: the DOM, and whatever was serialised into it. */
export async function wholePage(page: Page): Promise<string> {
  return page.content();
}

/**
 * C1.1 — none of the solution is in this page.
 *
 * Takes the page rather than a locator: a leak that lands in a `<script>` tag of
 * flight data is still a leak, and a locator scoped to the article would not see
 * it.
 */
export async function expectNoSolution(page: Page, where: string): Promise<void> {
  const html = await wholePage(page);
  for (const marker of KEPT_BACK) {
    expect(html, `${marker} reached the page — ${where}`).not.toContain(marker);
  }
}

/**
 * C6.1 — the attribution, which is a legal requirement rather than a caption.
 *
 * Asserted during the round and again after it, because "during **and** after"
 * is the clause and the current game's debrief covers the article entirely.
 */
export async function expectAttribution(page: Page): Promise<void> {
  await expect(page.getByText(/Text deliberately modified/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'CC BY-SA 4.0' })).toBeVisible();
}

// Making an account the suite can use, once.
//
// Three specs had their own copy of this, and all three carried the same
// defect: the pseudonym was `Ada` plus the **first six** base-36 digits of
// `Date.now()`, which drops the last two — so it only changes every 1296 ms and
// ignores the random suffix entirely. Two specs starting in the same second got
// the same pseudonym.
//
// That was harmless while a pseudonym was only a label on a `user` row. Step
// E.3.1 made it unique and E.3.2 made sign-up claim it, so it became a
// cross-worker collision: the second account to start in that window is carried
// off to `/choose-a-name` and every assertion after it fails, in whichever spec
// happened to lose. Found by exactly that failure.
//
// The email never had the bug — it used the whole stamp — which is why nothing
// noticed for four steps.
import type { Locator, Page } from '@playwright/test';

export interface Someone {
  readonly email: string;
  readonly password: string;
  readonly pseudonym: string;
}

/**
 * An account nobody else in this run — or any previous one — will ask for.
 *
 * The **whole** stamp in both fields: the clock keeps two accounts a second
 * apart distinct, the random suffix keeps two in the same millisecond distinct,
 * and neither alone is enough. Sixteen characters, inside `playerName`'s
 * twenty-four.
 *
 * `prefix` only names the spec in the address, so a row left behind says which
 * suite made it. It plays no part in uniqueness.
 */
export function someone(prefix = 'ada'): Someone {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return {
    email: `${prefix}-${stamp}@example.test`,
    password: 'a-password-of-real-length',
    pseudonym: `Ada${stamp}`,
  };
}

/** Fills one labelled field. Exact, so `Password` never matches a longer label. */
export function fill(page: Page, label: string, value: string): Promise<void> {
  return page.getByLabel(label, { exact: true }).fill(value);
}

/**
 * Creates the account, and waits for the screen it lands on.
 *
 * Step E.3.2 — sign-up claims the pseudonym once the account exists, so
 * "signed up" now means two round trips rather than one. Waiting for the URL
 * here rather than in each caller is what stops a spec from asserting against
 * a page that is still mid-claim.
 */
export async function signUp(page: Page, who: Someone): Promise<void> {
  await page.goto('/sign-up');
  await fill(page, 'Email', who.email);
  await fill(page, 'Pseudonym', who.pseudonym);
  await fill(page, 'Password', who.password);
  await page.getByRole('button', { name: 'Create the account' }).click();
}

/**
 * A screen's own alert, as opposed to Next's route announcer.
 *
 * **Both carry `role="alert"`**, and the announcer is mounted after every
 * client-side navigation — so a bare `getByRole('alert')` matches on a page with
 * nothing wrong with it, and matches *twice* on one that does have something
 * wrong, which is a strict-mode violation rather than an assertion.
 *
 * Scoped to the `form`, which the announcer sits outside of. Filtering by having
 * text was the first attempt and it is racy rather than wrong: the announcer is
 * empty for an instant and then holds the page title, so the same assertion
 * passes on a fast machine and fails on a loaded one. Where an element **is**
 * does not depend on when it is looked at.
 *
 * Here rather than in one spec because it cost two CI runs in two different
 * files: this is a property of the framework, not of a screen.
 */
export function said(page: Page): Locator {
  return page.locator('form').getByRole('alert');
}

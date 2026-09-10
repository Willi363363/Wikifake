// Track H's exit gate, checked rather than asserted in a review:
//
//   "No payment code, no price in currency, anywhere in the diff."
//
// It is the promise the whole track rests on. H.8 wrote down the seam a purchase
// *would* attach to and deliberately built none of it, and the failure mode is
// not a bad decision — it is a good one made in a hurry, six months from now, by
// somebody who never read the sheet. A payment provider's SDK is three lines to
// add and a quarter to remove.
//
// So the words are searched for. Here rather than in one package, because the
// integration nobody has chosen yet will land wherever it is convenient — and
// **a list of guarded files is a list the next integration is not on.**
//
// **Code only, and the plans are not searched.** That is not a loophole: a
// markdown file naming a payment provider is a plan saying *not that one* —
// `08-economy.md` says "No Stripe, no price in euros, no checkout" and
// `plans/rewrite/00-overview.md` puts monetisation out of scope in the same
// breath. Searching prose would flag exactly the documents that ruled it out,
// which is `purity.test.ts`'s comment problem in a file format that has no
// comments. The gate is about code, and so is this.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** Where the repository's own code lives. Not `node_modules`, not `.git`. */
const SEARCHED: readonly string[] = ['apps', 'packages', 'scripts'];

/** Directories no repository rule applies inside. */
const SKIP = new Set(['node_modules', '.next', '.turbo', 'dist', 'coverage']);

/**
 * The one file that may name what it is ruling out.
 *
 * One entry, and it must stay one: an exemption list is how a guard like this
 * gets switched off a file at a time, so a second name in here should be an
 * argument in a pull request rather than a line somebody added.
 */
const MAY_DISCUSS_PAYMENT = new Set(['packages/config/src/economy-seam.test.ts']);

function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (relative: string): void => {
    for (const entry of readdirSync(`${ROOT}${relative}`, { withFileTypes: true })) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(path);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|json|sh|sql|css)$/.test(entry.name)) continue;
      if (MAY_DISCUSS_PAYMENT.has(path)) continue;
      found.push(path);
    }
  };
  for (const top of SEARCHED) walk(top);
  return found.sort();
}

/**
 * Each pattern, and what its presence would mean.
 *
 * Deliberately narrow. A word like *charge* is everywhere already — a hint is
 * charged to the score — and a pattern that flagged it would be a pattern
 * somebody switches off. These are the ones that cannot mean anything else.
 */
const FORBIDDEN: readonly (readonly [RegExp, string])[] = [
  [/\bstripe\b/i, 'a payment provider: H.8 chose none'],
  [/\bpaddle(js)?\b/i, 'a payment provider: H.8 chose none'],
  [/\blemonsqueezy\b/i, 'a payment provider: H.8 chose none'],
  [/\bpaypal\b/i, 'a payment provider: H.8 chose none'],
  [/\bcheckout[_-]?session\b/i, 'a checkout: nothing here takes a payment'],
  [/\bpayment[_-]?intent\b/i, 'a checkout: nothing here takes a payment'],
  [/\bcard[_-]?number\b/i, 'card data: this repository must never hold any'],
  [/\biban\b/i, 'bank details: this repository must never hold any'],
  [/\bvat[_-]?(rate|number|id)\b/i, 'tax handling: H.8 lists it as not handled'],
  [/\binvoice[_-]?(number|id|pdf)\b/i, 'invoicing: H.8 lists it as not handled'],
  // A price in money rather than in coins. `amount` alone is the ledger's own
  // column, so the currency is what makes it a payment.
  [/\bcurrency[_-]?code\b/i, 'a price in currency: coins have no price in money'],
  [/\bprice[_-]?(eur|usd|cents)\b/i, 'a price in currency: coins have no price in money'],
];

/**
 * Comments come out first, the way `purity.test.ts` does it.
 *
 * Several files explain what they must not do — `coins.ts` says "no Stripe, no
 * price in euros, no checkout" in as many words — and searching the source as
 * written would flag exactly the ones that took the trouble to explain
 * themselves.
 *
 * Both `//` and `#`, because `scripts/` is shell.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const start = line.trimStart();
      return !start.startsWith('//') && !start.startsWith('#');
    })
    .join('\n');
}

describe('H.8 — no payment code, anywhere', () => {
  const files = sourceFiles();

  it('is sweeping the repository, not an empty list', () => {
    // The guard is only worth having if it is looking at the code. If the walk
    // ever stops finding files, this fails rather than the sweep quietly
    // passing over nothing.
    expect(files.length).toBeGreaterThan(300);
    expect(files).toContain('packages/db/src/schema/coins.ts');
    expect(files).toContain('packages/domain/src/coins.ts');
    expect(files).toContain('apps/web/src/shop/buy.ts');
  });

  it.each(FORBIDDEN)('finds no %s — %s', (pattern, why) => {
    const offenders = files.filter((path) =>
      pattern.test(withoutComments(readFileSync(`${ROOT}${path}`, 'utf8'))),
    );

    expect(offenders, `${offenders.join(', ')} — ${why}`).toEqual([]);
  });

  it('exempts this file, and nothing else', () => {
    expect([...MAY_DISCUSS_PAYMENT]).toEqual([
      'packages/config/src/economy-seam.test.ts',
    ]);
  });

  it('would notice a payment provider if one appeared', () => {
    // The sweep asserts an absence, and an absence is what a broken search also
    // reports. So the patterns are pointed at a string that should match.
    // The planted line names no environment accessor, and that is not
    // fussiness. `setup-files.test.ts` decides which packages read the
    // environment by searching their sources for that accessor — comments
    // included, unlike `purity.test.ts`, which strips them — so the first
    // version of this line made `packages/config` look like a package that
    // needs an env setup file, and failed that suite twice: once in the string
    // and once in the comment explaining the string.
    //
    // A planted example has to be inert in every sweep, not only in its own.
    const planted = 'const client = new Stripe(secretKey);';
    expect(FORBIDDEN.some(([pattern]) => pattern.test(planted))).toBe(true);
    // And at one that should not: `charged` is the hint ledger's own column.
    expect(FORBIDDEN.some(([pattern]) => pattern.test('charged: 0'))).toBe(false);
  });
});

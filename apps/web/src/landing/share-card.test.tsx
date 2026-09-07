/** @vitest-environment jsdom */

// The share card — step C.8, at the two levels a unit suite can reach.
//
// It is drawn by satori, from a tree of inline style objects, so **no scanner
// in this repository can see a single one of its colours.** `fills.test.ts`
// reads class names; the card has none. That is exactly the gap the crash page
// fell into — it wore phase 6's teal through the whole redesign because a hex
// inside `style={{ }}` is invisible to a scan of utilities — so this is
// `global-error.palette.test.ts`'s method applied to the one other file in the
// application that draws with literals.
//
// The other half is what the card *says*. Every word on it comes from the
// catalogue or from `excerpt.ts`, and the one thing that would quietly ruin it
// is marking the true figure instead of the false one: a card that highlights
// `330 m` is a card demonstrating that Wikipedia is correct.
//
// What no test here can see is the picture. That is `apps/e2e`'s — it fetches
// the PNG and reads its header — and, in the end, somebody looking at it.
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { EXCERPT, SHARE_AFTER, SHARE_BEFORE } from './excerpt.js';
import { CARD_SIZE, ShareCard } from './share-card.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(HERE, 'share-card.tsx'), 'utf8');
const THEME = readFileSync(
  join(HERE, '..', '..', '..', '..', 'packages', 'ui', 'src', 'theme.css'),
  'utf8',
);

/** The light palette's value for one `--color-*` token. */
function token(name: string): string {
  const block = THEME.slice(THEME.indexOf('@theme static {'));
  const found = new RegExp(String.raw`--color-${name}:\s*([^;]+);`).exec(block);
  if (found === null) throw new Error(`no --color-${name} in the theme`);
  return (found[1] as string).trim().toLowerCase();
}

/** The card's comments name the colours it does *not* use, so they go first. */
const CODE = SOURCE.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ');

const USED = new Set(
  [...CODE.matchAll(/#[0-9a-f]{6}\b/gi)].map((hex) => hex[0].toLowerCase()),
);

/** The tokens the card is allowed to draw with, and the whole of them. */
const PALETTE = ['bg', 'surface', 'ink', 'muted', 'accent', 'green', 'on-fill'];

const card = renderToStaticMarkup(
  <ShareCard question="Who is lying?" tagline="A tagline from the catalogue." />,
);

describe('C.8 — the card wears the current palette', () => {
  it('reads hex literals out of the card', () => {
    expect(USED.size).toBeGreaterThan(4);
  });

  it.each(PALETTE)('uses %s exactly as the theme declares it', (name) => {
    // The same string the stylesheet declares, not "about right". A ground one
    // shade off is invisible on a card and obvious beside any screen.
    expect(USED).toContain(token(name));
  });

  it('draws with nothing the theme does not declare', () => {
    const declared = new Set(PALETTE.map(token));
    expect([...USED].filter((hex) => !declared.has(hex))).toEqual([]);
  });
});

describe('C.8 — the card keeps the grammar', () => {
  it('rounds no corner', () => {
    // "Radius 0 on the chassis. The one exception is the paragraph token", and
    // there is no paragraph token here.
    expect(CODE).not.toContain('borderRadius');
  });

  it('blurs no shadow', () => {
    // A hard offset is three values and a colour: `16px 16px 0 #000`. A fourth
    // length is a blur, which this direction does not have.
    const shadows = [...CODE.matchAll(/boxShadow: `([^`]+)`/g)].map((found) => found[1]);
    expect(shadows.length).toBeGreaterThan(1);
    for (const shadow of shadows) expect(shadow).toContain('px 0 ');
  });

  it('has no gradient and no translucency', () => {
    expect(CODE).not.toContain('gradient');
    expect(CODE).not.toContain('rgba(');
    expect(CODE).not.toContain('opacity');
  });

  it('is the ratio every platform crops to', () => {
    // 1.91:1, which is what Open Graph asks for and what
    // `summary_large_image` shows. A square is cropped by all of them.
    expect(CARD_SIZE.width / CARD_SIZE.height).toBeCloseTo(1.91, 1);
  });
});

describe('C.8 — the card says what the site says', () => {
  it('carries the words it was handed', () => {
    // Props rather than constants: the route reads them from the catalogue, so
    // the card cannot be translated in one place and not the other.
    expect(card).toContain('Who is lying?');
    expect(card).toContain('A tagline from the catalogue.');
  });

  it('marks the falsified figure and not the true one', () => {
    // The whole demonstration. A card highlighting `330 m` shows a correct
    // encyclopaedia, which is a different product.
    expect(card).toContain(EXCERPT.claim);
    expect(card).not.toContain(EXCERPT.truth);
  });

  it('cuts the tail at a clause and marks the cut', () => {
    // A prefix of the quoted text, and an ellipsis. Nothing rewritten, so the
    // card cannot drift from the revision `excerpt.ts` names.
    expect(SHARE_AFTER.endsWith('…')).toBe(true);
    expect(EXCERPT.after.startsWith(SHARE_AFTER.slice(0, -1))).toBe(true);
    expect(SHARE_AFTER.length).toBeLessThan(EXCERPT.after.length);
  });

  it('cuts exactly the pronunciation gloss out of the head', () => {
    // The head is not a prefix — the gloss comes out of the middle — so the
    // claim is stated as the operation: this text, with the bracketed IPA
    // removed, is what the card shows. Wikipedia's, and clutter at a glance.
    const gloss = /\[[^\]]+\]/.exec(EXCERPT.before);
    expect(gloss).not.toBeNull();
    expect(SHARE_BEFORE).not.toContain(gloss?.[0]);
    expect(EXCERPT.before.replace(/\s*\[[^\]]+\]/, '')).toBe(SHARE_BEFORE);
  });
});

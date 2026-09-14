// The mark's colours, held to the theme's — and to the half of the theme that
// does not move.
//
// `mark.tsx` is drawn by satori, which resolves no custom property and loads no
// stylesheet, so its palette is two hex literals. The crash page is the reason
// this test exists rather than a comment: it wore phase 6's paper, ink and teal
// through an entire redesign because no scanner in this repository can see a
// hex inside a style object, and nothing failed.
//
// The second half is the one a favicon needs and a page does not. An icon is
// drawn once and shown in a tab strip, a home screen and an OS switcher, none
// of which say which palette they are in.
//
// **Track L took away the answer J.2 used.** Under the brutalist direction the
// accents were one colour on either ground, so the mark could simply use a
// theme-independent token and be right in both. J2 writes a light palette and a
// dark one together, and its accent inverts between them — a blue dark enough
// to carry white on paper disappears on near-black. `THEME_INDEPENDENT` is now
// empty, and there is no token left that answers the icon's question.
//
// So the rule becomes explicit rather than borrowed: **the mark wears the light
// palette's accent pair, named here, because a favicon has one rendering and
// the theme has two.** That is a decision with a cost — the icon is a little
// dark against a dark tab strip — and stating it is better than a mark that
// drifts because nothing said which palette it belonged to.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const MARK = readFileSync(join(HERE, 'mark.tsx'), 'utf8');
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

/**
 * The file with its comments removed.
 *
 * The comments name the colour a "W" would have been drawn in and the tokens
 * this may not use, so a scan that reads its own explanation is a scan to be
 * argued with rather than fixed.
 */
const CODE = MARK.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ');

/** The hex literals the mark actually draws with. */
const USED = new Set(
  [...CODE.matchAll(/#[0-9a-f]{6}\b/gi)].map((match) => match[0].toLowerCase()),
);

/** The tokens it claims to be copying. */
const CLAIMED = ['accent', 'on-fill'] as const;

describe('J.2 — the mark wears the current palette', () => {
  it('reads hex literals out of the file', () => {
    // A scan of nothing passes everything: if the mark stops carrying literals
    // — because somebody found a way to import the theme — this test is wrong
    // rather than green, and this is the line that says so.
    expect(USED.size).toBeGreaterThan(1);
  });

  it.each(CLAIMED)('uses %s exactly as the theme declares it', (name) => {
    expect(USED).toContain(token(name));
  });

  it('draws with nothing the theme does not declare', () => {
    const declared = new Set(CLAIMED.map(token));
    expect([...USED].filter((hex) => !declared.has(hex))).toEqual([]);
  });
});

describe('L.3 — and it is the light palette, deliberately', () => {
  /*
   * The assertion that replaces the theme-independence one.
   *
   * A favicon cannot answer "which palette am I in", so it does not ask: it
   * draws the light accent pair, always. What must not happen is the mark
   * quietly picking up the *dark* values — which would look right to whoever
   * changed them and wrong in every tab strip — so this reads the dark block
   * and checks the mark drew none of it.
   */
  it('draws none of the dark palette', () => {
    // The opening brace is part of what is searched for, and `theme.test.ts`
    // learned that the hard way: `.dark` on its own also matches the
    // `@custom-variant` line declaring what dark means, and the block found
    // from there is the light one — the assertion would then compare the light
    // palette with itself and pass.
    const at = THEME.indexOf('.dark {');
    expect(at).toBeGreaterThan(-1);
    const dark = THEME.slice(at);

    const darkValues = CLAIMED.map((name) => {
      const found = new RegExp(String.raw`--color-${name}:\s*([^;]+);`).exec(dark);
      expect({ name, declared: found !== null }).toEqual({ name, declared: true });
      return (found?.[1] ?? '').trim().toLowerCase();
    });

    expect([...USED].filter((hex) => darkValues.includes(hex))).toEqual([]);
  });
});

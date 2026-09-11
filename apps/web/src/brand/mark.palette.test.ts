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
// of which say which palette they are in. So the mark may only use tokens that
// are the same colour in both — `THEME_INDEPENDENT`, which `theme.test.ts`
// holds to that promise from the other side.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { THEME_INDEPENDENT } from '@wikifake/ui';
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

describe('J.2 — and only colours that cannot change under it', () => {
  it.each(CLAIMED)('%s is one of the theme-independent tokens', (name) => {
    expect(THEME_INDEPENDENT).toContain(name);
  });

  /*
   * The assertion the list above cannot make on its own.
   *
   * `THEME_INDEPENDENT` naming a token means the two palettes agree about it
   * today. This reads both palettes and checks that the *values the mark drew*
   * are the ones they agree on — so a token that quietly became theme-dependent
   * fails here as well as in `theme.test.ts`, and fails with the icon's name on
   * it rather than the theme's.
   */
  it('draws the same icon in either palette', () => {
    // The opening brace is part of what is searched for, and `theme.test.ts`
    // learned that the hard way: `.dark` on its own also matches the
    // `@custom-variant` line declaring what dark means, and the block found
    // from there is the light one — every assertion below would then compare
    // the light palette with itself and pass.
    const at = THEME.indexOf('.dark {');
    expect(at).toBeGreaterThan(-1);
    const dark = THEME.slice(at);

    for (const name of CLAIMED) {
      const found = new RegExp(String.raw`--color-${name}:\s*([^;]+);`).exec(dark);
      expect({ name, declared: found !== null }).toEqual({ name, declared: true });
      expect({ name, value: (found?.[1] ?? '').trim().toLowerCase() }).toEqual({
        name,
        value: token(name),
      });
    }
  });
});

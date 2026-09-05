// The crash page's colours, held to the theme's.
//
// `global-error.tsx` replaces the root layout, so it cannot import a
// stylesheet, read a custom property or use a utility class — a last-resort
// page that depends on the thing that broke is not a last resort. Its palette
// is therefore a set of hex literals in a style object.
//
// Which is exactly why it drifted. The brutalist palette changed every colour
// in the repository, and a scanner that reads class names cannot see a hex
// inside `style={{ }}`. The crash page went on wearing phase 6's warm paper
// (`#f6f4ef`), its ink (`#18181b`) and its teal primary button (`#1f574d`, with
// white text — 1.30:1 once the accent became yellow) through the whole change,
// and nothing failed.
//
// So the literals stay, and this reads them back out of the file and holds each
// one to the token it is copying. The duplication is unavoidable; a duplication
// nobody checks is not.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(HERE, 'global-error.tsx'), 'utf8');
const THEME = readFileSync(
  join(HERE, '..', '..', '..', 'packages', 'ui', 'src', 'theme.css'),
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
 * The file with its comments removed, in the shape of `language.test.ts`.
 *
 * The comments here name the colours this page used to wear and the face it
 * cannot load, because that is what a reader needs to know — and a scan that
 * reads its own explanation is a scan to be argued with rather than fixed.
 */
const CODE = PAGE.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ');

/** The hex literals the page actually draws with. */
const USED = new Set(
  [...CODE.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()),
);

describe('D.7 — the crash page wears the current palette', () => {
  it('reads hex literals out of the page', () => {
    expect(USED.size).toBeGreaterThan(3);
  });

  /*
   * Every colour it draws with is a token's value.
   *
   * Not "looks about right": the same string the stylesheet declares. A near
   * miss is the failure this is for — a background one shade off is invisible
   * on this page and obvious beside any other.
   */
  it.each(['bg', 'ink', 'muted', 'muted-2', 'accent', 'on-fill', 'line-strong'])(
    'uses %s exactly as the theme declares it',
    (name) => {
      expect(USED).toContain(token(name));
    },
  );

  it('draws with nothing the theme does not declare', () => {
    const declared = new Set(
      ['bg', 'ink', 'muted', 'muted-2', 'accent', 'on-fill', 'line-strong'].map(token),
    );
    expect([...USED].filter((hex) => !declared.has(hex))).toEqual([]);
  });

  // The button is the pair that broke, so it is named rather than implied: the
  // accent fill carries `on-fill`, which the audit measures at 16.13. White on
  // that fill is 1.30, and white on it is what this page used to do.
  it('puts on-fill on the accent, not paper', () => {
    expect(CODE).toMatch(
      new RegExp(
        String.raw`background: '${token('accent')}',\s*color: '${token('on-fill')}',`,
      ),
    );
  });

  /*
   * The font stack stays a system one, and that is not an oversight.
   *
   * `next/font` puts Archivo on the document through the root layout, and this
   * component replaces that layout. Naming Archivo here would name a face this
   * page has no way to load, and the browser would fall through to whatever
   * came after it — so the stack that comes after it is the whole stack.
   */
  it('asks for no font it cannot load', () => {
    expect(CODE).toContain('system-ui');
    expect(CODE).not.toContain('Archivo');
  });
});

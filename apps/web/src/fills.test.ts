// A fill is not a text colour, and this is what says so about the screens.
//
// `packages/ui` measures the pairs the *design system* declares —
// `CONTRAST_PAIRS`, forty ratios, all passing. What it cannot see is a pair an
// application invents: `text-danger` on the page is a foreground and a
// background nobody wrote down, so nothing measured it.
//
// That gap was not theoretical. When the brutalist palette landed the accents
// stopped being dark text colours and became saturated fills, and thirty-two
// places across these screens kept using them as text. Measured with the
// audit's own functions, in the light palette:
//
//   danger on bg          2.95   every error message
//   warn   on surface     1.83   the clock, at its most urgent
//   bronze on surface     2.01   what a hint costs
//   accent on accent-soft 1.20   a paragraph the player designated
//   green  on green-soft  1.47
//
// Every one of them passes in the dark palette, because a bright fill on a dark
// ground is exactly what it is good at. So the failure was invisible to anybody
// developing in dark mode, which is the part worth remembering.
//
// The fix was not to darken the fills — that would break the `on-fill` pairs,
// which are correct. It was to apply the direction's own rule: a wash carries
// `ink`, a fill carries `on-fill`, and a state that must read as a state is a
// block of colour rather than a coloured word.
//
// This scan is what stops the thirty-third from arriving quietly. It is
// deliberately a source scan rather than a rendering test: a rendering test
// checks the screens somebody thought to render, and the point here is the one
// nobody thought of.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

/**
 * The fills, from `plans/product/01-palette.md`.
 *
 * `on-fill` is not among them: it is the text colour *for* a fill, and it is
 * the answer rather than the problem.
 */
const FILLS = ['accent', 'accent-line', 'bronze', 'green', 'warn', 'danger'];

function sourcesIn(directory: string): { path: string; text: string }[] {
  return readdirSync(directory).flatMap((name) => {
    if (name === 'node_modules' || name === '.next') return [];
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourcesIn(path);
    if (!/\.tsx?$/.test(name) || name.includes('.test.')) return [];
    return [{ path: path.slice(WEB.length + 1), text: readFileSync(path, 'utf8') }];
  });
}

const SOURCES = [...sourcesIn(join(WEB, 'src')), ...sourcesIn(join(WEB, 'app'))];

describe('D — a fill is not a text colour', () => {
  it('has sources to check', () => {
    expect(SOURCES.length).toBeGreaterThan(30);
  });

  /*
   * `text-<fill>`, and nothing narrower.
   *
   * The lookahead is what keeps `text-accent-line` from being read as
   * `text-accent`, and what keeps this from matching a longer token that merely
   * starts the same way.
   */
  it.each(FILLS)('never writes text-%s', (fill) => {
    const offenders = SOURCES.filter(({ text }) =>
      new RegExp(String.raw`\btext-${fill}(?![\w-])`).test(text),
    ).map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  /*
   * `text-surface` is the same mistake seen from the other side.
   *
   * It was correct while the accents were dark: paper on a dark teal measured
   * about seven to one. On `#ffe14d` it is 1.30, and in the dark palette
   * `surface` is nearly black, so it fails there differently. The primary
   * button, the badges, the paragraph token's glyph and a chat bubble all
   * carried it.
   */
  it('never writes text-surface', () => {
    const offenders = SOURCES.filter(({ text }) =>
      /\btext-surface(?![\w-])/.test(text),
    ).map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  /*
   * A fill with an opacity modifier, wherever it has to be legible.
   *
   * `border-green/25` was how the old screens drew a soft edge: a value that
   * appears in no palette, measures against nothing, and changes meaning the
   * moment what is behind it changes. A border in this direction is the
   * structural one or it is not a border.
   *
   * **`bg` is deliberately not in this list**, and the exception is the reason
   * the item effects look the way they do. An item tints the whole screen —
   * `bg-danger/20` for the storm, `bg-accent/15` for the blizzard — and that
   * tint has to be translucent or it hides the article the effect is played
   * over. It carries no text and draws no edge, so there is nothing to measure
   * against and nothing to get wrong.
   *
   * What *was* wrong there was the announcement written across it in a fill
   * colour: an overlay's ground is whatever the article happens to be, so no
   * text on one has a measurable pair. Those are slabs now, each carrying its
   * own ground. The tint stays; the words stopped depending on it.
   */
  it.each(FILLS)('never derives an edge or a foreground from %s', (fill) => {
    const offenders = SOURCES.filter(({ text }) =>
      new RegExp(String.raw`\b(?:text|border|ring|shadow)-${fill}/\d`).test(text),
    ).map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  // Guards the guard. A scan whose pattern no longer matches anything, in any
  // form, is a scan that would pass on a screen written entirely in fills.
  it('would notice, if there were something to notice', () => {
    const bad = 'className="bg-accent-soft text-accent border-green/25 text-surface"';
    const caught = [
      ...FILLS.filter((fill) =>
        new RegExp(String.raw`\btext-${fill}(?![\w-])`).test(bad),
      ),
      ...FILLS.filter((fill) => new RegExp(String.raw`\bborder-${fill}/\d`).test(bad)),
      ...(/\btext-surface(?![\w-])/.test(bad) ? ['surface'] : []),
    ];
    expect(caught).toEqual(['accent', 'green', 'surface']);
  });
});

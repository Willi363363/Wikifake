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

/**
 * The same sources with their comments removed.
 *
 * The scans below name the classes they refuse, and this file is not the only
 * place that does: the components carry a line saying what they used to be, so
 * that the next reader learns the rule rather than rediscovering it. A scan
 * that read those comments would fail on the explanation of its own fix.
 */
const CODE = SOURCES.map(({ path, text }) => ({
  path,
  text: text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1'),
}));

/** The paths where `pattern` still appears, comments not counted. */
function offenders(pattern: RegExp): string[] {
  return CODE.filter(({ text }) => pattern.test(text)).map(({ path }) => path);
}

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

/*
 * The three the scan above could not see, found by looking at the screens.
 *
 * The sweep that wrote this file was pattern-driven, and each of these is a
 * spelling its patterns do not reach: a colour that never names a token, a
 * border whose width and whose hue are written on different lines, a hover
 * that says the opposite of the direction's without naming a colour at all.
 *
 * `01-art-direction.md` states all three as mechanical rules, which is what
 * makes them checkable rather than a matter of taste.
 */
describe('D — the grammar, where the fill scan cannot look', () => {
  /*
   * Paper on a fill, spelled so that no palette scan can see it.
   *
   * `player-cursors.tsx` drew every rival's name as `text-white` on
   * `style={{ background: cursor.colour }}`, and the colour is a value from
   * `PLAYER_COLOURS` — server data, eight hues, half light and half dark. No
   * single text colour passes on all eight, so the pair was not merely
   * unmeasured: it was unmeasurable. The colour is a swatch now and the name
   * is `ink` on `surface`.
   *
   * `text-transparent` is deliberately not caught: it is not a colour, it is
   * the memory card hiding its glyph while keeping it in the document.
   */
  it.each(['white', 'black'])('never writes text-%s', (word) => {
    expect(offenders(new RegExp(String.raw`\btext-${word}(?![\w-])`))).toEqual([]);
  });

  it.each(['white', 'black'])('never fills with %s', (word) => {
    expect(offenders(new RegExp(String.raw`\bbg-${word}(?![\w-])`))).toEqual([]);
  });

  it('never hands an SVG a colour outside the palette', () => {
    expect(offenders(/(?:stroke|fill)="(?:white|black|#[0-9a-fA-F]{3,8})"/)).toEqual([]);
  });

  /*
   * A colour-on-colour border.
   *
   * "3px solid ink. Never a hairline, never a colour-on-colour border." Six
   * places drew `border-accent` on `bg-accent-soft`, `border-green` on
   * `bg-green-soft` — a yellow edge round a yellow wash, at 1px, which is a
   * state said twice and legible neither time. The edge is `line-strong`
   * everywhere now and the state is the fill.
   *
   * The `/\d` form has its own scan above, and it stays there: an edge derived
   * from a fill at 25% is a different mistake with the same cause.
   */
  it.each(FILLS)('never draws an edge in %s', (fill) => {
    expect(offenders(new RegExp(String.raw`\bborder-${fill}(?![\w-])`))).toEqual([]);
  });

  /*
   * The hover that lifts.
   *
   * "The shadow collapses and the element shifts 2px into it. Nothing else
   * moves." The item bar did the reverse — rise a pixel, *gain* a `shadow-md`
   * — which is the previous identity's lift and glow, kept because a sweep
   * looking for colours has no reason to read a transform.
   */
  it('never lifts on hover', () => {
    expect(offenders(/hover:-translate-y-/)).toEqual([]);
  });

  it('never grows a shadow on hover', () => {
    expect(offenders(/hover:shadow-(?:sm|md|lg)(?![\w-])/)).toEqual([]);
  });

  // Guards the guard, as above: three patterns that match nothing are three
  // tests that pass on a screen doing all three.
  it('would notice, if there were something to notice', () => {
    const bad =
      'className="text-white bg-black border-accent hover:-translate-y-px hover:shadow-md" stroke="white"';
    expect(/\btext-white(?![\w-])/.test(bad)).toBe(true);
    expect(/\bbg-black(?![\w-])/.test(bad)).toBe(true);
    expect(/\bborder-accent(?![\w-])/.test(bad)).toBe(true);
    expect(/hover:-translate-y-/.test(bad)).toBe(true);
    expect(/hover:shadow-(?:sm|md|lg)(?![\w-])/.test(bad)).toBe(true);
    expect(/(?:stroke|fill)="(?:white|black|#[0-9a-fA-F]{3,8})"/.test(bad)).toBe(true);
  });

  // And guards the comment-stripping, which is the part that could silently
  // turn every scan above into a scan of nothing.
  it('strips comments without stripping code', () => {
    const stripped = CODE.find(({ path }) =>
      path.endsWith(join('round', 'player-cursors.tsx')),
    );

    expect(stripped?.text).not.toContain('text-white');
    expect(stripped?.text).toContain('border-3 border-line-strong');
  });
});

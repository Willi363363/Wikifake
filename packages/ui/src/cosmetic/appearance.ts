// What a cosmetic looks like — step H.6.
//
// **Here rather than in `@wikifake/domain`**, and that is H.5's decision being
// paid off: the catalogue holds identifiers and prices and says nothing about
// appearance, because *this* is the package with the contrast machinery in it.
// A colour declared next to a price is a colour no test ever measures.
//
// The one rule that makes selling colours safe:
//
//   **A cosmetic may only colour a decoration that carries no text.**
//
// The paragraph token's marked state is a `bg-accent-soft` wash with `ink` on
// it, and that pair is in `CONTRAST_PAIRS` at 19.31:1. Nothing here touches it.
// What a marker colours is the bar *under* the paragraph — `aria-hidden`, no
// children, a rectangle. So the requirement is not AA text contrast, which would
// be the wrong test; it is WCAG 1.4.11 non-text contrast, **3:1 against the
// ground**, so that a player can see the thing they paid for. `appearance.test.ts`
// measures every colour against both palettes' grounds.
//
// A mark style and a frame carry no colour at all: they are a shape and a border
// treatment, expressed in tokens the theme already ships.
import type { Rgba } from '../contrast.js';

/**
 * The marker colours, by identifier.
 *
 * Raw hex rather than a theme token, and the precedent is `PLAYER_COLOURS`:
 * a room already draws players in eight literal colours, because a player's
 * colour is an *identity* rather than a role. A theme token means "what this
 * colour is for", and there is no role called "Ada's crimson".
 *
 * One value per cosmetic across both palettes, for the reason
 * `THEME_INDEPENDENT` gives about fills: a bought colour that changed when the
 * page went dark would be two cosmetics wearing one name.
 *
 * **That constraint decides the palette, and it was measured rather than
 * chosen.** One hex clearing 3:1 against a near-white ground *and* a near-black
 * one has to sit in a narrow band of luminance — the first four candidates were
 * `#c1121f`, `#b45309`, `#6d28d9` and `#334155`, and three of them failed on the
 * dark ground at 1.8:1 to 2.4:1. Every colour that passes both lands at the same
 * balance point, so **these four are told apart by hue alone.**
 *
 * That is normally the thing this design system refuses — the paragraph token's
 * three bronze states are told apart by border *style* precisely because hue
 * alone is not enough. The difference is what is lost when the distinction is
 * lost: a verdict a player cannot tell apart is a verdict they cannot read, and
 * a marker colour they cannot tell apart is two players who both like red.
 * A marker carries no meaning, which is what makes hue enough here and only
 * here.
 */
export const MARKER_COLOURS: Readonly<Record<string, string>> = {
  MARKER_CRIMSON: '#d64b4d',
  MARKER_AMBER: '#cc5814',
  MARKER_VIOLET: '#9d5ae0',
  MARKER_SLATE: '#5f7cad',
};

/**
 * How the marked decoration is drawn, by identifier.
 *
 * `null` — no cosmetic — is the underline the token has always had: a 4px bar
 * across the bottom. The three below are the same bar rearranged, and none of
 * them covers a word:
 *
 *   - `underline` is the default made explicit, so a player can buy their way
 *     back to it after wearing something else;
 *   - `bracket` moves it to the two vertical edges;
 *   - `corner` keeps only the four corners.
 *
 * Classes rather than a component, so the token stays one element and the
 * cosmetic is a string it interpolates. A component per style would be three
 * more things to keep accessible.
 */
export const MARK_STYLES: Readonly<Record<string, string>> = {
  MARK_STYLE_UNDERLINE: 'inset-x-1 -bottom-0.5 h-1',
  MARK_STYLE_BRACKET: 'inset-y-1 -inset-x-0.5 w-full border-x-3 bg-transparent',
  MARK_STYLE_CORNER:
    'inset-1 border-3 [clip-path:polygon(0_0,25%_0,25%_25%,0_25%,0_75%,25%_75%,25%_100%,0_100%,100%_100%,75%_100%,75%_75%,100%_75%,100%_25%,75%_25%,75%_0,100%_0)]',
};

/** The default decoration, which is what `null` in the marker slot means. */
export const DEFAULT_MARK_STYLE = MARK_STYLES['MARK_STYLE_UNDERLINE'] as string;

/**
 * The frame around a pseudonym, by identifier.
 *
 * Border treatments in the theme's own tokens, not colours: a frame is seen
 * beside forty-nine other pseudonyms on a leaderboard, and forty-nine bought
 * colours is a table nobody can read. `line-strong` is the structural border
 * every card already uses, so a frame reads as part of the design rather than
 * stuck on to it.
 */
export const FRAMES: Readonly<Record<string, string>> = {
  FRAME_HAIRLINE: 'border border-line-strong px-1',
  FRAME_DOUBLE: 'border-3 border-double border-line-strong px-1',
  FRAME_NOTCHED:
    'border-3 border-line-strong px-1 [clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)]',
};

/**
 * The colour a worn marker draws in, or **null for the theme's own accent**.
 *
 * Null rather than the accent's hex, so that a caller falls back to the class it
 * already had. Returning a colour would make every unadorned token carry an
 * inline style, and an inline style is what a theme switch cannot reach.
 *
 * Unknown identifiers are null: a retired cosmetic must draw the default rather
 * than nothing at all, which is `cosmeticById`'s rule arriving at the screen.
 */
export function markerColourFor(id: string | null): string | null {
  if (id === null) return null;
  return MARKER_COLOURS[id] ?? null;
}

/** The decoration classes a worn mark style asks for, defaulting to the bar. */
export function markStyleFor(id: string | null): string {
  if (id === null) return DEFAULT_MARK_STYLE;
  return MARK_STYLES[id] ?? DEFAULT_MARK_STYLE;
}

/** The frame classes a worn frame asks for, or the empty string for none. */
export function frameFor(id: string | null): string {
  if (id === null) return '';
  return FRAMES[id] ?? '';
}

/**
 * The two grounds a decoration has to be visible on.
 *
 * `--color-bg` of each palette, read out of `theme.css` by the test rather than
 * repeated here — except that a module cannot read a stylesheet, so the test
 * does the reading and this only says which token it is looking for.
 */
export const DECORATION_GROUNDS: readonly string[] = ['bg', 'surface'];

/** WCAG 1.4.11: a graphical object needs 3:1 against what is behind it. */
export const NON_TEXT_CONTRAST = 3;

/** Whether a colour is visible enough to be a decoration on this ground. */
export function isVisibleDecoration(
  ratio: (one: Rgba, other: Rgba) => number,
  colour: Rgba,
  ground: Rgba,
): boolean {
  return ratio(colour, ground) >= NON_TEXT_CONTRAST;
}

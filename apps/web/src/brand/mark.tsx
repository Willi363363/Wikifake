// Step J.2 — the mark, at the sizes a tab and a home screen ask for.
//
// **Why a question mark and not a letter.** The wordmark the share card wears —
// WIKIFAKE, spaced, in a yellow box — is unreadable at 16 CSS pixels, which is
// what a browser tab actually shows. The obvious reduction is its initial, and
// a yellow "W" is the one thing this project must not draw: Wikipedia's own
// favicon is a W, this game reads `fr.wikipedia.org` without being endorsed by
// the foundation, and C.8 already refused the globe for that reason. The
// landing's first line is "Who is lying?", so the question is the game. It is
// nobody's mark, and it survives being 16 pixels wide.
//
// **Why it does not follow the theme.** An icon is stamped into a tab strip, a
// home screen and an OS switcher, none of which tell a page what palette they
// are in — and half of them draw it on their own ground. The two tokens used
// here are `accent` and `on-fill`, which are two of the seven in
// `THEME_INDEPENDENT`: the same colour in both palettes by design, so the icon
// is not a drawing that guessed, it is a drawing that cannot vary.
// `mark.palette.test.ts` holds both halves of that.
//
// The grammar is `01-art-direction.md`'s, restated at this scale the way the
// share card restates it at its own: a flat fill, a square, and a structural
// border that is a *proportion* rather than 3px. Three pixels on a 512px canvas
// is a hairline, and a hairline is the one thing the direction says a border is
// never. What it does not carry is the offset shadow — a shadow is a distance
// between a surface and the one behind it, and an icon has nothing behind it.
import type { ReactElement } from 'react';

/**
 * The palette, from `packages/ui/src/theme.css`.
 *
 * Copied rather than imported, like `global-error.tsx` and the share card: this
 * is drawn by satori, which resolves no custom property and loads no
 * stylesheet. `mark.palette.test.ts` reads these back out of the file and holds
 * each one to the token it copies, because a duplication nobody checks is how
 * the crash page wore the previous palette through an entire redesign.
 */
const ACCENT = '#ffe14d';
const ON_FILL = '#000000';

/**
 * The sizes drawn, and the ids they are served under.
 *
 * 32 is the tab, the bookmark bar and every favicon list; 192 is what Android
 * puts on a home screen; 512 is the splash screen and the install prompt.
 * `app/icon.tsx` turns each into a route and `app/manifest.ts` names the two
 * that belong in a manifest — both from this list, so an icon cannot be
 * declared at a size nothing draws.
 */
export const ICON_SIZES = [32, 192, 512] as const;

/** 180×180, which is the one size Apple asks for and never reads a manifest to find. */
export const APPLE_ICON_SIZE = 180;

/**
 * The border, as a proportion of the canvas.
 *
 * A sixteenth: 2 pixels at 32 and 32 at 512. It is the weight a 3px border has
 * on the 48px chip the direction draws it on, which is the comparison that
 * matters — an icon is a chip with nothing else in it.
 */
const BORDER_RATIO = 1 / 16;

/**
 * The glyph, as a proportion of the canvas.
 *
 * Archivo's question mark at 0.7em fills the tile the way the wordmark fills
 * its box on the card: close to the border, without touching it.
 */
const GLYPH_RATIO = 0.7;

export interface BrandMarkProps {
  /** The canvas, in pixels. Square, because every consumer of this is. */
  readonly size: number;
}

/**
 * The mark, as satori draws it.
 *
 * Flexbox only, and every box says its `display` — satori supports `flex`,
 * `block` and `none`, and refuses an element with children that has not chosen.
 */
export function BrandMark({ size }: BrandMarkProps): ReactElement {
  const border = Math.max(1, Math.round(size * BORDER_RATIO));

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT,
        border: `${String(border)}px solid ${ON_FILL}`,
        color: ON_FILL,
        fontFamily: 'Archivo',
        fontWeight: 800,
        fontSize: Math.round(size * GLYPH_RATIO),
        // A question mark sits high in its line box, and a tile is judged on
        // whether it looks centred rather than on whether it is. `1` is the
        // line box the glyph asked for, with no leading either side of it.
        lineHeight: 1,
      }}
    >
      ?
    </div>
  );
}

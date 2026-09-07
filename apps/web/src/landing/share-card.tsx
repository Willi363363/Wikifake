// Step C.8 — the card a shared link becomes.
//
// What it replaces was wrong on four counts at once, which is why this is a
// step rather than a swap. `public/image.png` was 1024×1024 served into a
// `summary_large_image` slot that is 1.91:1 — so every platform cropped it —
// carried French text under an interface that is English and French, was drawn
// in a serif on a gradient with nothing of `01-art-direction.md` in it, and
// imitated the Wikipedia globe puzzle, which is a registered mark of a
// foundation this project is not endorsed by and reads facts from.
//
// **Rendered rather than committed.** A PNG in `public/` is a picture of the
// copy at the moment somebody exported it; this is built from the catalogue and
// from `excerpt.ts` on every deploy, so a card that says something the site no
// longer says is not a state this can be in. It is also how it is translated
// at all: one image per locale, from the same file.
//
// The grammar is `01-art-direction.md`'s, at the one scale it has to be
// restated at. A card is shown at about 500 CSS pixels wide in a timeline and
// nearer 360 in a chat client, so a 3px border drawn on a 1200px canvas arrives
// as one and a bit and reads as a hairline — the one thing the direction says a
// border is never. The weights below are that 3px multiplied through: the
// canvas is 2.4× the widest display size, so the border is 8 and the offset
// shadow is 16.
import type { ReactElement } from 'react';

import { EXCERPT, SHARE_AFTER, SHARE_BEFORE } from './excerpt.js';

/**
 * 1200×630 — the ratio every platform crops to, at the size they all accept.
 *
 * Open Graph asks for 1.91:1 and at least 600×315; Twitter's
 * `summary_large_image` wants the same ratio and at most 5MB. One size answers
 * all of them, and it is the one nothing has to crop.
 */
export const CARD_SIZE = { width: 1200, height: 630 } as const;

/** The palette, from `plans/product/01-palette.md`'s light values. */
const INK = '#000000';
const PAPER = '#fffcf2';
const SURFACE = '#ffffff';
const ACCENT = '#ffe14d';
const GREEN = '#5fe08b';
const ON_FILL = '#000000';
const MUTED = '#57544b';

/** The structural border and its offset, multiplied to the canvas — see above. */
const BORDER = 8;
const OFFSET = 16;

export interface ShareCardProps {
  /** The question, from `home.question`. The card's whole first move. */
  readonly question: string;
  /** One line under the sheet, from `seo.tagline`. */
  readonly tagline: string;
}

/**
 * The card, as satori draws it.
 *
 * Flexbox only, and every box says its `display`: satori supports `flex`,
 * `block` and `none`, and it refuses an element with several children that has
 * not chosen. The extract's three pieces are three spans in a wrapping row for
 * that reason — a paragraph with a `<span>` in the middle is exactly the case
 * it will not lay out.
 */
export function ShareCard({ question, tagline }: ShareCardProps): ReactElement {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: PAPER,
        color: INK,
        fontFamily: 'Archivo',
        padding: 64,
      }}
    >
      {/* The brand, as a fill rather than as a word. `on-fill` is black on the
          yellow, which is the one hard colour rule of the direction and the
          reason the accents are never text. */}
      <div style={{ display: 'flex' }}>
        <div
          style={{
            display: 'flex',
            backgroundColor: ACCENT,
            border: `${String(BORDER)}px solid ${INK}`,
            boxShadow: `${String(OFFSET)}px ${String(OFFSET)}px 0 ${INK}`,
            padding: '10px 24px',
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: 6,
          }}
        >
          WIKIFAKE
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* The question. Everything else on the card exists to be read after
            it, and at 500px wide in a timeline it is the only thing that is
            certain to be read at all. */}
        <div style={{ display: 'flex', fontSize: 104, fontWeight: 800, lineHeight: 1 }}>
          {question}
        </div>

        {/* The demonstration: a real paragraph with one figure marked. The
            reading surface is exempt from the grammar — no fill, no shadow on
            the prose itself — but the *sheet* is chassis, so it keeps the
            border and the offset. That contrast is the design.

            French in both locales, and `excerpt.ts` says why: the game reads
            `fr.wikipedia.org`, so a card showing an English paragraph would
            advertise a game that does not exist. What crosses the language is
            the mark, which needs no words. */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            marginTop: 36,
            backgroundColor: SURFACE,
            border: `${String(BORDER)}px solid ${INK}`,
            boxShadow: `${String(OFFSET)}px ${String(OFFSET)}px 0 ${INK}`,
            padding: '24px 28px',
            fontSize: 32,
            fontWeight: 400,
            lineHeight: 1.5,
          }}
        >
          <span>{SHARE_BEFORE}</span>
          {/* The fill, not the wash — and this is the one place the card
              deliberately differs from the landing it advertises.

              In the page the mark is `green-soft`, because it sits inside a
              reading sheet a player has to read several hundred words of and a
              saturated block there is noise. A card is looked at for half a
              second, at 360 CSS pixels wide in a chat client, where
              `#dbf7e6` on white is nothing at all. `green` is the debrief's
              verdict chip, which is a flat fill in the direction's own words,
              and `on-fill` is the black it measures at 12.52:1 against.

              The falsified value is what is marked. A card showing the true
              one demonstrates nothing. */}
          <span style={{ backgroundColor: GREEN, color: ON_FILL, padding: '0 10px' }}>
            {EXCERPT.claim}
          </span>
          <span>{SHARE_AFTER}</span>
        </div>
      </div>

      <div style={{ display: 'flex', fontSize: 30, fontWeight: 400, color: MUTED }}>
        {tagline}
      </div>
    </div>
  );
}

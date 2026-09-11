// Step J.2 — `GET /manifest.webmanifest`, what an installed WikiFake is called.
//
// **One document, in the default locale, and that is a limitation rather than a
// choice.** Next serves a manifest from the application root only; there is no
// `[locale]` segment to put it under, and an operating system reads it once, at
// install time, from a URL with no language in it. So the words come from the
// catalogue — never from a literal, which is how the French half rots — but
// from one locale of it. A French player who installs the game gets an English
// home-screen label until this is negotiated, and negotiating a document the OS
// caches indefinitely is its own decision. Recorded in `plans/product/10-seo-icons.md`.
//
// The colours are the theme's, copied for the same reason the mark's are:
// nothing here can read a custom property. `manifest.test.ts` holds them to
// `theme.css`, and holds every icon named here to a size `icon.tsx` draws.
import type { MetadataRoute } from 'next';

import { messagesFor } from '../src/i18n/catalogue.js';
import { DEFAULT_LOCALE } from '../src/i18n/locales.js';
import { ICON_SIZES } from '../src/brand/mark.js';

/** `--color-bg`: the paper, which is what a splash screen should be. */
const BACKGROUND = '#fffcf2';

/**
 * `--color-accent`: the browser chrome, which is chassis rather than reading
 * surface.
 *
 * The direction's one exemption is the surface an article is read on, and a
 * status bar is not it. Everything structural in this game is the yellow.
 */
const THEME = '#ffe14d';

/**
 * The sizes a manifest is for.
 *
 * 32 is a tab and belongs in a `<link>`, not on a home screen. Filtered from
 * `ICON_SIZES` rather than listed again, so an icon cannot be promised here at
 * a size no route draws.
 */
const INSTALLED_SIZES = ICON_SIZES.filter((size) => size >= 192);

/**
 * The brand, which is not translated.
 *
 * `short_name` is what fits under an icon — twelve characters, give or take,
 * and truncated without mercy past that. The share card makes the same call
 * about the same word: what crosses the language is the mark.
 */
const SHORT_NAME = 'WikiFake';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { seo } = await messagesFor(DEFAULT_LOCALE);

  return {
    name: seo.title,
    short_name: SHORT_NAME,
    description: seo.description,
    lang: DEFAULT_LOCALE,
    // The front door, which the proxy hands to the player's own language. An
    // installed shortcut therefore opens in French for somebody whose browser
    // asks for French, whatever the words above say.
    start_url: '/',
    display: 'standalone',
    background_color: BACKGROUND,
    theme_color: THEME,
    icons: INSTALLED_SIZES.map((size) => ({
      src: `/icon/${String(size)}`,
      sizes: `${String(size)}x${String(size)}`,
      type: 'image/png',
      // `any` and no `maskable`, deliberately. A maskable icon is cropped to
      // the platform's own shape, and a mark whose border *is* the grammar
      // cannot be cropped — a maskable variant would be a second drawing, which
      // is not what this step is for. Android puts a square tile on its own
      // ground instead, which is what a stamp should do.
      purpose: 'any',
    })),
  };
}

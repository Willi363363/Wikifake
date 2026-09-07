// Step C.8 — the share image, generated per locale.
//
// Next's file convention: an `opengraph-image` beside a segment supplies
// `og:image` for that segment and everything under it, with its URL, its size
// and its alt filled in for us. `layout.tsx` therefore stops naming an image at
// all — an explicit `openGraph.images` would override this, which is exactly
// how a stale `/image.png` outlived four redesigns — and `twitter.images`
// follows it, because Next inherits the Open Graph images wherever Twitter has
// not been given its own.
//
// It sits at `[locale]` rather than beside the landing page so that a room link
// and a solo link share it. Those routes are kept out of a crawler's way by
// `robots.ts`, which is about *indexing*; a link somebody pastes into a chat is
// not indexed, and arriving as a bare URL with no card is the one thing a
// shared game link must not do.
//
// The card itself is `src/landing/share-card.tsx`. This file is the plumbing:
// which locale, which words, which fonts.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

import { hasLocale } from 'next-intl';

import { messagesFor } from '../../src/i18n/catalogue.js';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '../../src/i18n/locales.js';
import { CARD_SIZE, ShareCard } from '../../src/landing/share-card.js';

/*
 * No `generateStaticParams` here, and it is not an omission.
 *
 * Next's metadata-route loader writes one of its own, derived from
 * `generateImageMetadata` below, and a second export of that name is a build
 * failure whose message quotes the loader's generated source rather than this
 * file — a confusing five minutes for whoever hits it next.
 */
export const contentType = 'image/png';
export const size = CARD_SIZE;

/**
 * The alt text, per locale.
 *
 * `generateImageMetadata` rather than a bare `alt` export, and the difference
 * is the whole reason it is here: `alt` is a module constant and cannot know
 * which locale it is being asked about, so a French card would have carried an
 * English description of itself. This receives the segment's params.
 *
 * An `og:image:alt` is not decoration. It is what a screen reader announces
 * when the card is the whole of a shared post, and what stands in for the image
 * wherever it does not load.
 */
export async function generateImageMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ id: string; alt: string; size: typeof CARD_SIZE; contentType: string }[]> {
  const { seo } = await messagesFor(await localeFrom(params));
  return [{ id: 'card', alt: seo.imageAlt, size, contentType }];
}

/**
 * The `[locale]` segment, or the default.
 *
 * `layout.tsx` calls `notFound()` on an unknown segment and is right to: that
 * is a page nobody asked for. An image route cannot usefully 404 — the segment
 * has already been validated by the page a crawler read the tag off — so an
 * unknown one falls back rather than serving a broken card.
 */
async function localeFrom(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  return hasLocale(LOCALES, locale) ? locale : DEFAULT_LOCALE;
}

/**
 * The two weights, read from the repository rather than fetched.
 *
 * `next/font/google` downloads Archivo at build time for the *pages*, and there
 * is no supported way to reach those files from here — so the card would have
 * been drawn in the one face `next/og` bundles, which is a regular-weight Geist.
 * On a direction whose first rule is "a very bold grotesque", that is not a
 * near miss.
 *
 * Committed instead, under the SIL Open Font License that `fonts/LICENSE.txt`
 * carries: 220kB for both weights, against the 630kB PNG this step deletes.
 * Fetching them from Google at request time would put a third party between a
 * shared link and its card, on a path with no fallback.
 *
 * **Read from disk, not fetched, and the documented way round is the one that
 * does not work here.** Next's own example is
 * `fetch(new URL('./font.ttf', import.meta.url))`; webpack rewrites that
 * expression into the *asset* URL it emitted — `/_next/static/media/…` — and a
 * server-side `fetch` of a path with no origin throws `ERR_INVALID_URL`. The
 * build succeeds and the route 500s, which is a link with no card and no
 * failing test unless somebody fetches the image. This one does.
 *
 * `process.cwd()` is the application directory under `next start` and under a
 * traced deployment alike; `next.config.ts` names these two files in
 * `outputFileTracingIncludes` so the tracer, which cannot see through a runtime
 * `join`, ships them with the function.
 */
const FONTS = join(process.cwd(), 'src', 'landing', 'fonts');

async function archivo(): Promise<{ name: string; data: Buffer; weight: 400 | 800 }[]> {
  const [regular, extraBold] = await Promise.all([
    readFile(join(FONTS, 'archivo-400.ttf')),
    readFile(join(FONTS, 'archivo-800.ttf')),
  ]);

  return [
    { name: 'Archivo', data: regular, weight: 400 },
    { name: 'Archivo', data: extraBold, weight: 800 },
  ];
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ImageResponse> {
  const locale = await localeFrom(params);
  const { home, seo } = await messagesFor(locale);

  return new ImageResponse(<ShareCard question={home.question} tagline={seo.tagline} />, {
    ...size,
    fonts: await archivo(),
  });
}

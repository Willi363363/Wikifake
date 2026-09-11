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
import { ImageResponse } from 'next/og';

import { hasLocale } from 'next-intl';

import { archivo } from '../../src/brand/fonts.js';
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

/*
 * The face is loaded by `src/brand/fonts.ts`, which says why it is read off
 * disk rather than fetched and why it is committed rather than downloaded. It
 * moved there in step J.2, when the icons became its second and third reader.
 */

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<ImageResponse> {
  const locale = await localeFrom(params);
  const { home, seo } = await messagesFor(locale);

  return new ImageResponse(<ShareCard question={home.question} tagline={seo.tagline} />, {
    ...size,
    fonts: [...(await archivo([400, 800]))],
  });
}

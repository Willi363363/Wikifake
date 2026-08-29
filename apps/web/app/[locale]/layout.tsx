// The document every page is rendered into.
//
// The first one: until now this application served routes and no pages at all.
// What it carries is deliberately minimal — the screens are phases 7 and 8, and
// a layout that started deciding navigation would be deciding them here.
//
// `lang` follows the interface locale — step 11.5, and the amendment of C6.3.
// The attribute was pinned to `"fr"` from the legacy stack until this step,
// under an interface that had become English; now the document says what the
// interface speaks, and the one thing that stays French whatever the locale is
// the article itself, which carries its own `lang` in `round/article.tsx`. The
// clause and its tests were amended together, as phase 11 requires.
import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { messagesFor } from '../../src/i18n/catalogue.js';
import { LocaleSwitch } from '../../src/i18n/locale-switch.js';
import { LOCALES, type Locale } from '../../src/i18n/locales.js';
import { absolute, localePath, siteOrigin } from '../../src/indexing.js';

import '../globals.css';

/**
 * The `og:locale` value each interface locale declares.
 *
 * Open Graph wants the `language_TERRITORY` form. The old stack declared
 * `fr_FR` unconditionally; since step 11.5 each locale declares its own, and
 * the layout test holds the pair — `lang` and `og:locale` — together.
 */
const OG_LOCALES: Record<Locale, string> = { en: 'en_US', fr: 'fr_FR' };

/** The `[locale]` segment, validated: an unknown segment is not a page. */
async function localeFrom(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(LOCALES, locale)) notFound();
  return locale;
}

/**
 * C6.3 — the metadata, per locale since step 11.5.
 *
 * The title and the description come from the `seo` zone of the catalogue, so
 * a search result speaks the language of the page it points at. The
 * `hreflang` alternates name every locale's URL for the same page — plus
 * `x-default` for the language-less request, which the proxy answers by
 * detection — and the canonical is the locale's own root, so a preview never
 * competes with production and the two locales never compete with each other.
 *
 * `metadataBase` is what lets every relative URL below resolve — Next resolves
 * `alternates` and `openGraph.url` against it, so the origin is decided once,
 * in `src/indexing.ts`, and not spelled out per tag.
 *
 * These alternates are the one place the locale URLs are emitted:
 * `routing.ts` keeps `alternateLinks` off so the same statement is not also
 * made as a `Link` header, half-consistently, on every route a crawler is
 * kept out of anyway.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await localeFrom(params);
  const { seo } = await messagesFor(locale);
  const home = localePath(locale, '/');

  return {
    metadataBase: new URL(siteOrigin()),
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: home,
      languages: {
        ...Object.fromEntries(LOCALES.map((other) => [other, localePath(other, '/')])),
        'x-default': '/',
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'WikiFake',
      url: absolute(home),
      title: seo.title,
      description: seo.description,
      images: ['/image.png'],
      locale: OG_LOCALES[locale],
      alternateLocale: LOCALES.filter((other) => other !== locale).map(
        (other) => OG_LOCALES[other],
      ),
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: ['/image.png'],
    },
  };
}

/**
 * Declared rather than left to a default.
 *
 * Without it a phone lays the page out at about 980 CSS pixels and scales the
 * result down, and every breakpoint below `lg` is dead code — which is the state
 * the current game ships in for all but one of its screens. Next supplies this
 * by default; naming it is what makes it a decision somebody can see.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await localeFrom(params);

  return (
    <html lang={locale}>
      <body className="bg-bg text-ink">
        {/* Step 11.1: every screen below reads its copy through `next-intl`.
            No props on purpose — rendered in a server component, the provider
            inherits the locale and the messages from `src/i18n/request.ts`,
            so the request configuration stays the single source of both. */}
        <NextIntlClientProvider>
          {children}
          {/* Step 11.3 — the explicit switch, in the one surface every screen
              shares. Not navigation between screens (the restraint above
              stands): it re-serves the page the player is on, in the other
              language, and records the choice. */}
          <footer className="flex justify-center pb-6">
            <LocaleSwitch />
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

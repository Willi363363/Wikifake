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
import { Archivo, JetBrains_Mono } from 'next/font/google';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { messagesFor } from '../../src/i18n/catalogue.js';
import { LocaleSwitch } from '../../src/i18n/locale-switch.js';
import { LegalLinks } from '../../src/legal/links.js';
import { LOCALES, type Locale } from '../../src/i18n/locales.js';
import { absolute, localePath, siteOrigin } from '../../src/indexing.js';

import '../globals.css';

/*
 * The two families, self-hosted at build time.
 *
 * `next/font/google` downloads the files during the build and serves them from
 * our own origin. No request to a third party at runtime, nothing for a content
 * policy to allow, and the metrics are known before the first paint — so no
 * layout shift when the face arrives.
 *
 * **Archivo carries the whole interface.** It is one variable file across the
 * weight axis, which is what makes `01-art-direction.md`'s "one family, two
 * weights" cost one download rather than two: display is the same face at 800,
 * body is it at 400. It was drawn for highlights *and* for text, which is the
 * unusual property being relied on here — most grotesques bold enough for this
 * direction are unpleasant to read a paragraph in.
 *
 * **JetBrains Mono is the second family, and the argument for it is not
 * aesthetic.** Players type a room code. A face where `0` and `O`, or `1`, `l`
 * and `I`, are hard to tell apart turns a shared code into a failed join, and
 * that is a real defect rather than a matter of taste — this one slashes the
 * zero and separates the three. It carries codes, scores, timers and badges.
 *
 * Latin only, on both: the interface is English and French, and the article
 * text is French. Loading Cyrillic and Greek would be paying for coverage
 * nothing renders.
 */
const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
});

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
      // **No `images` here, and that is step C.8's whole mechanism.** The
      // `opengraph-image.tsx` beside this file supplies the URL, the size and
      // the per-locale alt; an explicit entry would override it, which is how a
      // French serif logo at 1024×1024 survived four redesigns in this slot.
      locale: OG_LOCALES[locale],
      alternateLocale: LOCALES.filter((other) => other !== locale).map(
        (other) => OG_LOCALES[other],
      ),
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      // Nor here: Next fills `twitter.images` from the Open Graph ones wherever
      // Twitter has not been given its own, so the card is stated once.
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
    <html lang={locale} className={`${archivo.variable} ${jetbrainsMono.variable}`}>
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
          {/* Step J.3 puts the two documents beside it, for the reason the
              switch is here at all: this is the one surface every screen
              shares, and a policy a player in a round cannot reach is a
              policy that answers nobody. */}
          <footer className="flex flex-col items-center gap-2 pb-6">
            <LocaleSwitch />
            <LegalLinks />
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

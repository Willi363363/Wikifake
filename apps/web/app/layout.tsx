// The document every page is rendered into.
//
// The first one: until now this application served routes and no pages at all.
// What it carries is deliberately minimal — the screens are phases 7 and 8, and
// a layout that started deciding navigation would be deciding them here.
//
// `lang="fr"` is C6.3, and it stays here for now even though the interface above
// it is English. Two things are true at once: the article, the topics and the
// falsifications are French, and every word the game itself says is not. The
// honest markup is `lang="en"` on the document with the article's own text
// marked `lang="fr"` — which is half done, in `round/article.tsx`.
//
// The other half is **step 11.5's**, and deliberately: `lang` is a clause of
// `02-contract-transport-and-compliance.md`, and phase 11 amends the clause and
// its test together when the attribute becomes per-locale. Changing it here
// would be changing a preserved guarantee in a step that does not own it.
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

import { absolute, SITE_DESCRIPTION, SITE_TITLE, siteOrigin } from '../src/indexing.js';

import './globals.css';

/**
 * C6.3 — the metadata, in the language of the interface.
 *
 * English from step 8.10, like every other word the game says. It becomes
 * per-locale in step 11.5, alongside the `hreflang` alternates.
 *
 * Step 10.0 adds the three halves that were missing and that C6.3 names: the
 * canonical link, Open Graph and the Twitter card. Without them a shared link
 * shows neither title nor image, which is what the old stack's `indexing.test.js`
 * was written to prevent, and a preview URL competes with production for the
 * same content in an index.
 *
 * `metadataBase` is what lets every relative URL below resolve — Next resolves
 * `alternates` and `openGraph.url` against it, so the origin is decided once, in
 * `src/indexing.ts`, and not spelled out per tag.
 *
 * No `og:locale`: the old stack declared `fr_FR`, and the honest value now is
 * neither that nor `en`, since the document is still `lang="fr"` under an
 * English interface. Step 11.5 owns that pair and will set both together.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'WikiFake',
    url: absolute('/'),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ['/image.png'],
  },
};

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-bg text-ink">
        {/* Step 11.1: every screen below reads its copy through `next-intl`.
            No props on purpose — rendered in a server component, the provider
            inherits the locale and the messages from `src/i18n/request.ts`,
            so the request configuration stays the single source of both. */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
